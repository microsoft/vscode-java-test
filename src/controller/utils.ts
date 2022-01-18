// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import * as path from 'path';
import * as fse from 'fs-extra';
import { performance } from 'perf_hooks';
import { CancellationToken, commands, Range, TestItem, Uri, workspace, WorkspaceFolder } from 'vscode';
import { sendError } from 'vscode-extension-telemetry-wrapper';
import { INVOCATION_PREFIX, JavaTestRunnerDelegateCommands } from '../constants';
import { IJavaTestItem, ProjectType, TestKind, TestLevel } from '../types';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { getRequestDelay, lruCache, MovingAverage } from './debouncing';
import { runnableTag, testController } from './testController';
import { dataCache } from './testItemDataCache';

/**
 * Load the Java projects, which are the root nodes of the test explorer
 */
export async function loadJavaProjects(): Promise<void> {
    let testProjects: IJavaTestItem[] = [];
    for (const workspaceFolder of workspace.workspaceFolders || [] ) {
        testProjects.push(...await getJavaProjects(workspaceFolder));
    }

    if (testProjects.length === 1 && testProjects[0].testKind === TestKind.None &&
                await getProjectType(testProjects[0]) === ProjectType.UnmanagedFolder) {
        commands.executeCommand('setContext', 'java:needSetupTests', true);
        return;
    }

    testProjects = testProjects.filter((project: IJavaTestItem) => {
        return project.testKind !== TestKind.None;
    });

    for (const project of testProjects) {
        if (testController?.items.get(project.id)) {
            continue;
        }

        const projectItem: TestItem = createTestItem(project);
        projectItem.canResolveChildren = true;
        testController?.items.add(projectItem);
    }
}

export async function getProjectType(item: IJavaTestItem): Promise<ProjectType> {
    if (item.testLevel !== TestLevel.Project) {
        throw new Error('The test item is not a project');
    }

    if (!item.natureIds) {
        return ProjectType.Other;
    }

    const hasClasspathFile: boolean = await fse.pathExists(path.join(Uri.parse(item.uri!).fsPath, '.classpath'));
    let hasJavaNature: boolean = false;
    for (const id of item.natureIds) {
        if (id.includes('maven2Nature')) {
            return ProjectType.Maven;
        }

        if (id.includes('gradleprojectnature')) {
            return ProjectType.Gradle;
        }

        if (id.includes('javanature')) {
            hasJavaNature = true;
        }
    }

    if (hasJavaNature && !hasClasspathFile) {
        return ProjectType.UnmanagedFolder;
    }

    return ProjectType.Other;
}

/**
 * This method is used to synchronize the test items for the given parent node recursively. which means:
 * - If an existing child is not contained in the childrenData parameter, it will be deleted
 * - If a child does not exist, create it, otherwise, update it as well as its metadata.
 */
export function synchronizeItemsRecursively(parent: TestItem, childrenData: IJavaTestItem[] | undefined): void {
    if (childrenData) {
        // remove the out-of-date children
        parent.children.forEach((child: TestItem) => {
            if (child.id.startsWith(INVOCATION_PREFIX)) {
                // only remove the invocation items before a new test session starts
                return;
            }
            const existingItem: IJavaTestItem | undefined = childrenData.find((data: IJavaTestItem) => data.id === child.id);
            if (!existingItem) {
                parent.children.delete(child.id);
            }
        });
        // update/create children
        for (const child of childrenData) {
            const childItem: TestItem = updateOrCreateTestItem(parent, child);
            if (child.testLevel <= TestLevel.Class) {
                childItem.canResolveChildren = true;
            }
            synchronizeItemsRecursively(childItem, child.children);
        }
    }
}

function updateOrCreateTestItem(parent: TestItem, childData: IJavaTestItem): TestItem {
    let childItem: TestItem | undefined = parent.children.get(childData.id);
    if (childItem) {
        updateTestItem(childItem, childData);
    } else {
        childItem = createTestItem(childData, parent);
    }
    return childItem;
}

function updateTestItem(testItem: TestItem, metaInfo: IJavaTestItem): void {
    testItem.range = asRange(metaInfo.range);
    if (metaInfo.testLevel !== TestLevel.Invocation) {
        dataCache.set(testItem, {
            jdtHandler: metaInfo.jdtHandler,
            fullName: metaInfo.fullName,
            projectName: metaInfo.projectName,
            testLevel: metaInfo.testLevel,
            testKind: metaInfo.testKind,
        });
    }
}

/**
 * Create test item which will be shown in the test explorer
 * @param metaInfo The data from the server side of the test item
 * @param parent The parent node of the test item (if it has)
 * @returns The created test item
 */
export function createTestItem(metaInfo: IJavaTestItem, parent?: TestItem): TestItem {
    if (!testController) {
        throw new Error('Failed to create test item. The test controller is not initialized.');
    }
    const item: TestItem = testController.createTestItem(
        metaInfo.id,
        metaInfo.label,
        metaInfo.uri ? Uri.parse(metaInfo.uri) : undefined,
    );
    item.range = asRange(metaInfo.range);
    if (metaInfo.testLevel !== TestLevel.Invocation) {
        item.tags = [runnableTag];
        dataCache.set(item, {
            jdtHandler: metaInfo.jdtHandler,
            fullName: metaInfo.fullName,
            projectName: metaInfo.projectName,
            testLevel: metaInfo.testLevel,
            testKind: metaInfo.testKind,
        });
    }
    if (parent) {
        parent.children.add(item);
    }
    return item;
}

let updateNodeForDocumentTimeout: NodeJS.Timer;
/**
 * Update test item in a document with adaptive debounce enabled.
 * @param uri uri of the document
 * @param testTypes test metadata
 */
export async function updateItemForDocumentWithDebounce(uri: Uri, testTypes?: IJavaTestItem[]): Promise<TestItem[]> {
    if (updateNodeForDocumentTimeout) {
        clearTimeout(updateNodeForDocumentTimeout);
    }
    const timeout: number = getRequestDelay(uri);
    return new Promise<TestItem[]>((resolve: (items: TestItem[]) => void): void => {
        updateNodeForDocumentTimeout = setTimeout(async () => {
            const startTime: number = performance.now();
            const result: TestItem[] = await updateItemForDocument(uri, testTypes);
            const executionTime: number = performance.now() - startTime;
            const movingAverage: MovingAverage = lruCache.get(uri) || new MovingAverage();
            movingAverage.update(executionTime);
            lruCache.set(uri, movingAverage);
            return resolve(result);
        }, timeout);
    });
}

/**
 * Update test item in a document immediately.
 * @param uri uri of the document
 * @param testTypes test metadata
 */
export async function updateItemForDocument(uri: Uri, testTypes?: IJavaTestItem[]): Promise<TestItem[]> {
    testTypes = testTypes ?? await findTestTypesAndMethods(uri.toString());

    let belongingPackage: TestItem | undefined;
    if (testTypes.length === 0) {
        belongingPackage = await resolveBelongingPackage(uri);
    } else {
        belongingPackage = findBelongingPackageItem(testTypes[0]) || await resolveBelongingPackage(uri);
    }
    if (!belongingPackage) {
        sendError(new Error('Failed to find the belonging package'));
        return [];
    }

    const tests: TestItem[] = [];
    if (testTypes.length === 0) {
        // Remove the children with the same uri when no test items is found
        belongingPackage.children.forEach((typeItem: TestItem) => {
            if (path.relative(typeItem.uri?.fsPath || '', uri.fsPath) === '') {
                belongingPackage!.children.delete(typeItem.id);
            }
        });
    } else {
        for (const testType of testTypes) {
            // here we do not directly call synchronizeItemsRecursively() because testTypes here are just part of the
            // children of the belonging package, we don't want to delete other children unexpectedly.
            let testTypeItem: TestItem | undefined = belongingPackage.children.get(testType.id);
            if (!testTypeItem) {
                testTypeItem = createTestItem(testType, belongingPackage);
                testTypeItem.canResolveChildren = true;
            } else {
                updateTestItem(testTypeItem, testType);
            }
            tests.push(testTypeItem);
            synchronizeItemsRecursively(testTypeItem, testType.children);
        }
    }

    if (belongingPackage.children.size === 0) {
        belongingPackage.parent?.children.delete(belongingPackage.id);
    }

    return tests;
}

/**
 * Give a test item for a type, find its belonging package item according to its id.
 */
function findBelongingPackageItem(testType: IJavaTestItem): TestItem | undefined {
    const indexOfProjectSeparator: number = testType.id.indexOf('@');
    if (indexOfProjectSeparator < 0) {
        return undefined;
    }
    const projectId: string = testType.id.substring(0, indexOfProjectSeparator);
    const projectItem: TestItem | undefined = testController?.items.get(projectId);
    if (!projectItem) {
        return undefined;
    }
    const indexOfPackageSeparator: number = testType.id.lastIndexOf('.');
    const packageId: string = testType.id.substring(indexOfProjectSeparator + 1, indexOfPackageSeparator);
    const packageItem: TestItem | undefined = projectItem.children.get(`${projectId}@${packageId}`);
    return packageItem;
}

/**
 * Give a document uri, resolve its belonging package item.
 */
async function resolveBelongingPackage(uri: Uri): Promise<TestItem | undefined> {
    const pathsData: IJavaTestItem[] = await resolvePath(uri.toString());
    if (_.isEmpty(pathsData) || pathsData.length < 2) {
        return undefined;
    }

    const projectData: IJavaTestItem = pathsData[0];
    if (projectData.testLevel !== TestLevel.Project) {
        return undefined;
    }

    let belongingProject: TestItem | undefined = testController?.items.get(projectData.id);
    if (!belongingProject) {
        belongingProject = createTestItem(projectData);
        testController?.items.add(belongingProject);
        belongingProject.canResolveChildren = true;
    }

    const packageData: IJavaTestItem = pathsData[1];
    if (packageData.testLevel !== TestLevel.Package) {
        return undefined;
    }

    let belongingPackage: TestItem | undefined = belongingProject.children.get(packageData.id);
    if (!belongingPackage) {
        belongingPackage = createTestItem(packageData, belongingProject);
        belongingPackage.canResolveChildren = true;
    }
    return belongingPackage;
}

/**
 * Parse the range object with server mode to client format
 * @param range range with server side format
 */
export function asRange(range: any): Range | undefined {
    if (!range) {
        return undefined;
    }
    return new Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

export async function getJavaProjects(workspaceFolder: WorkspaceFolder, token?: CancellationToken): Promise<IJavaTestItem[]> {
    return await executeJavaLanguageServerCommand<IJavaTestItem[]>(
        JavaTestRunnerDelegateCommands.FIND_JAVA_PROJECTS, workspaceFolder.uri.toString(), token) || [];
}

export async function findTestPackagesAndTypes(handlerId: string, token?: CancellationToken): Promise<IJavaTestItem[]> {
    return await executeJavaLanguageServerCommand<IJavaTestItem[]>(
        JavaTestRunnerDelegateCommands.FIND_TEST_PACKAGES_AND_TYPES, handlerId, token) || [];
}

export async function findDirectTestChildrenForClass(handlerId: string, token?: CancellationToken): Promise<IJavaTestItem[]> {
    return await executeJavaLanguageServerCommand<IJavaTestItem[]>(
        JavaTestRunnerDelegateCommands.FIND_DIRECT_CHILDREN_FOR_CLASS, handlerId, token) || [];
}

export async function findTestTypesAndMethods(uri: string, token?: CancellationToken): Promise<IJavaTestItem[]> {
    return await executeJavaLanguageServerCommand<IJavaTestItem[]>(
        JavaTestRunnerDelegateCommands.FIND_TEST_TYPES_AND_METHODS, uri, token) || [];
}

export async function resolvePath(uri: string): Promise<IJavaTestItem[]> {
    return await executeJavaLanguageServerCommand<IJavaTestItem[]>(
        JavaTestRunnerDelegateCommands.RESOLVE_PATH, uri) || [];
}
