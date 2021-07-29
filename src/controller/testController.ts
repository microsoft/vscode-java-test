// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, FileSystemWatcher, RelativePattern, TestController, TestItem, tests, Uri, workspace } from 'vscode';
import { instrumentOperation, sendError } from 'vscode-extension-telemetry-wrapper';
import { extensionContext, isStandardServerReady } from '../extension';
import { testSourceProvider } from '../provider/testSourceProvider';
import { IJavaTestItem, TestLevel } from '../types';
import { dataCache, ITestItemData } from './testItemDataCache';
import { findDirectTestChildrenForClass, findTestPackagesAndTypes, findTestTypesAndMethods, loadJavaProjects, resolvePath, synchronizeItemsRecursively } from './utils';

export let testController: TestController | undefined;

export function createTestController(): void {
    if (!isStandardServerReady()) {
        return;
    }
    testController?.dispose();
    testController = tests.createTestController('javaTestController', 'Java Test');

    testController.resolveHandler = async (item: TestItem) => {
        await loadChildren(item);
    };

    startWatchingWorkspace();
}

export const loadChildren: (item: TestItem, token?: CancellationToken) => any = instrumentOperation('java.test.explorer.loadChildren', async (_operationId: string, item: TestItem, token?: CancellationToken) => {
    if (!item) {
        await loadJavaProjects();
        return;
    }

    const data: ITestItemData | undefined = dataCache.get(item);
    if (!data) {
        return;
    }
    if (data.testLevel === TestLevel.Project) {
        const packageAndTypes: IJavaTestItem[] = await findTestPackagesAndTypes(data.jdtHandler, token);
        synchronizeItemsRecursively(item, packageAndTypes);
    } else if (data.testLevel === TestLevel.Package) {
        // unreachable code
    } else if (data.testLevel === TestLevel.Class) {
        if (!data.jdtHandler) {
            sendError(new Error('The class node does not have jdt handler id.'));
            return;
        }
        const testMethods: IJavaTestItem[] = await findDirectTestChildrenForClass(data.jdtHandler, token);
        synchronizeItemsRecursively(item, testMethods);
    }
});

async function startWatchingWorkspace(): Promise<void> {
    if (!workspace.workspaceFolders) {
        return;
    }

    for (const workspaceFolder of workspace.workspaceFolders) {
        const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern(workspaceFolder);
        for (const pattern of patterns) {
            const watcher: FileSystemWatcher = workspace.createFileSystemWatcher(pattern);
            extensionContext.subscriptions.push(
                watcher,
                watcher.onDidCreate(async (uri: Uri) => {
                    const testTypes: IJavaTestItem[] = await findTestTypesAndMethods(uri.toString());
                    if (testTypes.length === 0) {
                        return;
                    }
                    // todo: await updateNodeForDocumentWithDebounce(uri, testTypes);
                }),
                watcher.onDidChange(async (uri: Uri) => {
                    // todo: await updateNodeForDocumentWithDebounce(uri);
                }),
                watcher.onDidDelete(async (uri: Uri) => {
                    const pathsData: IJavaTestItem[] = await resolvePath(uri.toString());
                    if (_.isEmpty(pathsData) || pathsData.length < 2) {
                        return;
                    }

                    const projectData: IJavaTestItem = pathsData[0];
                    if (projectData.testLevel !== TestLevel.Project) {
                        return;
                    }

                    const belongingProject: TestItem | undefined = testController?.items.get(projectData.id);
                    if (!belongingProject) {
                        return;
                    }

                    const packageData: IJavaTestItem = pathsData[1];
                    if (packageData.testLevel !== TestLevel.Package) {
                        return;
                    }

                    const belongingPackage: TestItem | undefined = belongingProject.children.get(packageData.id);
                    if (!belongingPackage) {
                        return;
                    }

                    belongingPackage.children.forEach((item: TestItem) => {
                        if (item.uri?.toString() === uri.toString()) {
                            belongingPackage.children.delete(item.id);
                        }
                    });

                    if (belongingPackage.children.size === 0) {
                        belongingProject.children.delete(belongingPackage.id);
                    }
                }),
            );
        }
    }
}
