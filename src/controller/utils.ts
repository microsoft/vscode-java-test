// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, Range, TestItem, Uri, workspace, WorkspaceFolder } from 'vscode';
import { INVOCATION_PREFIX, JavaTestRunnerDelegateCommands } from '../constants';
import { IJavaTestItem, TestLevel } from '../types';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { testController } from './testController';
import { dataCache } from './testItemDataCache';

/**
 * Load the Java projects, which are the root nodes of the test explorer
 */
export async function loadJavaProjects(): Promise<void> {
    for (const workspaceFolder of workspace.workspaceFolders || [] ) {
        const testProjects: IJavaTestItem[] = await getJavaProjects(workspaceFolder);
        for (const project of testProjects) {
            if (testController?.items.get(project.id)) {
                continue;
            }
            const projectItem: TestItem = createTestItem(project);
            projectItem.canResolveChildren = true;
            testController?.items.add(projectItem);
        }
    }
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
