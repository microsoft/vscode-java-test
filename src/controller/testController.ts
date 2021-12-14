// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, DebugConfiguration, Disposable, FileSystemWatcher, RelativePattern, TestController, TestItem, TestRun, TestRunProfileKind, TestRunRequest, tests, TestTag, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { instrumentOperation, sendError, sendInfo } from 'vscode-extension-telemetry-wrapper';
import { INVOCATION_PREFIX } from '../constants';
import { IProgressReporter } from '../debugger.api';
import { isStandardServerReady, progressProvider } from '../extension';
import { testSourceProvider } from '../provider/testSourceProvider';
import { IExecutionConfig } from '../runConfigs';
import { BaseRunner } from '../runners/baseRunner/BaseRunner';
import { JUnitRunner } from '../runners/junitRunner/JunitRunner';
import { TestNGRunner } from '../runners/testngRunner/TestNGRunner';
import { IJavaTestItem, IRunTestContext, TestKind, TestLevel } from '../types';
import { loadRunConfig } from '../utils/configUtils';
import { resolveLaunchConfigurationForRunner } from '../utils/launchUtils';
import { dataCache, ITestItemData } from './testItemDataCache';
import { findDirectTestChildrenForClass, findTestPackagesAndTypes, findTestTypesAndMethods, loadJavaProjects, resolvePath, synchronizeItemsRecursively, updateItemForDocumentWithDebounce } from './utils';

export let testController: TestController | undefined;
export const watchers: Disposable[] = [];
export const runnableTag: TestTag = new TestTag('RunnableItem');

export function createTestController(): void {
    if (!isStandardServerReady()) {
        return;
    }
    testController?.dispose();
    testController = tests.createTestController('javaTestController', 'Java Test');

    testController.resolveHandler = async (item: TestItem) => {
        await loadChildren(item);
    };

    testController.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandler, true, runnableTag);
    testController.createRunProfile('Debug Tests', TestRunProfileKind.Debug, runHandler, true, runnableTag);

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

    for (const disposable of watchers) {
        disposable.dispose();
    }

    for (const workspaceFolder of workspace.workspaceFolders) {
        const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern(workspaceFolder);
        for (const pattern of patterns) {
            const watcher: FileSystemWatcher = workspace.createFileSystemWatcher(pattern);
            watchers.push(
                watcher,
                watcher.onDidCreate(async (uri: Uri) => {
                    const testTypes: IJavaTestItem[] = await findTestTypesAndMethods(uri.toString());
                    if (testTypes.length === 0) {
                        return;
                    }
                    await updateItemForDocumentWithDebounce(uri, testTypes);
                }),
                watcher.onDidChange(async (uri: Uri) => {
                    await updateItemForDocumentWithDebounce(uri);
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

async function runHandler(request: TestRunRequest, token: CancellationToken): Promise<void> {
    await runTests(request, { token, isDebug: !!request.profile?.label.includes('Debug') });
}

export const runTests: (request: TestRunRequest, option: IRunOption) => any = instrumentOperation('java.test.runTests', async (operationId: string, request: TestRunRequest, option: IRunOption) => {
    sendInfo(operationId, {
        isDebug: `${option.isDebug}`,
    });

    const testItems: TestItem[] = await new Promise<TestItem[]>(async (resolve: (result: TestItem[]) => void): Promise<void> => {
        option.progressReporter = option.progressReporter ?? progressProvider?.createProgressReporter(option.isDebug ? 'Debug Tests' : 'Run Tests');
        option.token?.onCancellationRequested(() => {
            option.progressReporter?.done();
            return resolve([]);
        });
        const progressToken: CancellationToken | undefined = option.progressReporter?.getCancellationToken();
        option.onProgressCancelHandler = progressToken?.onCancellationRequested(() => {
            option.progressReporter?.done();
            return resolve([]);
        });
        option.progressReporter?.report('Searching tests...');
        const result: TestItem[] = await getIncludedItems(request, progressToken);
        await expandTests(result, TestLevel.Method, progressToken);
        return resolve(result);
    });

    if (testItems.length === 0) {
        option.progressReporter?.done();
        return;
    }

    const run: TestRun = testController!.createTestRun(request);
    try {
        await new Promise<void>(async (resolve: () => void): Promise<void> => {
            const token: CancellationToken = option.token ?? run.token;
            token.onCancellationRequested(() => {
                option.progressReporter?.done();
                run.end();
                return resolve();
            });
            enqueueTestMethods(testItems, run);
            const queue: TestItem[][] = mergeTestMethods(testItems);
            for (const testsInQueue of queue) {
                if (testsInQueue.length === 0) {
                    continue;
                }
                const testProjectMapping: Map<string, TestItem[]> = mapTestItemsByProject(testsInQueue);
                for (const [projectName, itemsPerProject] of testProjectMapping.entries()) {
                    const testKindMapping: Map<TestKind, TestItem[]> = mapTestItemsByKind(itemsPerProject);
                    for (const [kind, items] of testKindMapping.entries()) {
                        if (option.progressReporter?.isCancelled()) {
                            option.progressReporter = progressProvider?.createProgressReporter(option.isDebug ? 'Debug Tests' : 'Run Tests');
                        }
                        let delegatedToDebugger: boolean = false;
                        option.onProgressCancelHandler?.dispose();
                        option.progressReporter?.getCancellationToken().onCancellationRequested(() => {
                            if (delegatedToDebugger) {
                                // If the progress reporter has been delegated to debugger, a cancellation event
                                // might be emitted due to debug session finished, thus we will ignore such event.
                                return;
                            }
                            option.progressReporter?.done();
                            return resolve();
                        });
                        option.progressReporter?.report('Resolving launch configuration...');
                        // TODO: improve the config experience
                        const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(items[0].uri!);
                        if (!workspaceFolder) {
                            window.showErrorMessage(`Failed to get workspace folder from test item: ${items[0].label}.`);
                            continue;
                        }
                        const config: IExecutionConfig | undefined = await loadRunConfig(workspaceFolder);
                        if (!config) {
                            continue;
                        }
                        const testContext: IRunTestContext = {
                            isDebug: option.isDebug,
                            kind,
                            projectName,
                            testItems: items,
                            testRun: run,
                            workspaceFolder,
                        };
                        sendInfo(operationId, {
                            testFramework: TestKind[testContext.kind],
                        });
                        const runner: BaseRunner | undefined = getRunnerByContext(testContext);
                        if (!runner) {
                            window.showErrorMessage(`Failed to get suitable runner for the test kind: ${testContext.kind}.`);
                            continue;
                        }
                        try {
                            await runner.setup();
                            const resolvedConfiguration: DebugConfiguration = option.launchConfiguration ?? await resolveLaunchConfigurationForRunner(runner, testContext, config);
                            resolvedConfiguration.__progressId = option.progressReporter?.getId();
                            delegatedToDebugger = true;
                            await runner.run(resolvedConfiguration, token, option.progressReporter);
                        } finally {
                            await runner.tearDown();
                        }
                    }
                }
            }
            return resolve();
        });
    } finally {
        run.end();
    }
});

/**
 * Set all the test item to queued state
 */
function enqueueTestMethods(testItems: TestItem[], run: TestRun): void {
   const queuedTests: TestItem[] = [...testItems];
   while (queuedTests.length) {
       const queuedTest: TestItem = queuedTests.shift()!;
       run.enqueued(queuedTest);
       queuedTest.children.forEach((child: TestItem) => {
           queuedTests.push(child);
       });
   }
}

/**
 * Filter out the tests which are in the excluding list
 * @param request the test run request
 * @returns
 */
async function getIncludedItems(request: TestRunRequest, token?: CancellationToken): Promise<TestItem[]> {
   let testItems: TestItem[] = [];
   if (request.include) {
       testItems.push(...request.include);
   } else {
       testController?.items.forEach((item: TestItem) => {
           testItems.push(item);
       });
   }
   if (testItems.length === 0) {
       return [];
   }
   removeTestInvocations(testItems);
   testItems = await expandTests(testItems, TestLevel.Class, token);
   // @ts-expect-error
   const excludingItems: TestItem[] = await expandTests(request.exclude || [], TestLevel.Class, token);
   testItems = _.differenceBy(testItems, excludingItems, 'id');
   return testItems;
}

/**
 * Expand the test items to the target level
 * @param testItems items to expand
 * @param targetLevel target level to expand
 */
async function expandTests(testItems: TestItem[], targetLevel: TestLevel, token?: CancellationToken): Promise<TestItem[]> {
    const results: Set<TestItem> = new Set();
    const queue: TestItem[] = [...testItems];
    while (queue.length) {
        const item: TestItem = queue.shift()!;
        const testLevel: TestLevel | undefined = dataCache.get(item)?.testLevel;
        if (testLevel === undefined) {
            continue;
        }
        if (testLevel >= targetLevel) {
            results.add(item);
        } else {
            await loadChildren(item, token);
            item.children.forEach((child: TestItem) => {
                queue.push(child);
            });
        }
    }
    return Array.from(results);
}

/**
 * Remove the test invocations since they might be changed
 */
function removeTestInvocations(testItems: TestItem[]): void {
    const queue: TestItem[] = [...testItems];
    while (queue.length) {
        const item: TestItem = queue.shift()!;
        if (item.id.startsWith(INVOCATION_PREFIX)) {
            item.parent?.children.delete(item.id);
            continue;
        }
        item.children.forEach((child: TestItem) => {
            queue.push(child);
        });
    }
}

/**
 * Eliminate the test methods if they are contained in the test class.
 * Because the current test runner cannot run class and methods for the same time,
 * in the returned array, all the classes are in one group and each method is a group.
 */
function mergeTestMethods(testItems: TestItem[]): TestItem[][] {
    // tslint:disable-next-line: typedef
    const classMapping: Map<string, TestItem> = testItems.reduce((map, i) => {
        const testLevel: TestLevel | undefined = dataCache.get(i)?.testLevel;
        if (testLevel === undefined) {
            return map;
        }
        if (testLevel === TestLevel.Class) {
            map.set(i.id, i);
        }
        return map;
    }, new Map());

    // tslint:disable-next-line: typedef
    const testMapping: Map<TestItem, Set<TestItem>> = testItems.reduce((map, i) => {
        const testLevel: TestLevel | undefined = dataCache.get(i)?.testLevel;
        if (testLevel === undefined) {
            return map;
        }
        if (testLevel !== TestLevel.Method) {
            return map;
        }

        // skip the method if it's contained in test classes
        if (classMapping.has(i.parent?.id || '')) {
            return map;
        }

        const value: Set<TestItem> | undefined = map.get(i.parent);
        if (value) {
            value.add(i as TestItem);
        } else {
            map.set(i.parent, new Set([i]));
        }

        return map;
    }, new Map());

    const testMethods: TestItem[][] = [];

    for (const [key, value] of testMapping) {
        if (key.children.size === value.size) {
            classMapping.set(key.id, key);
        } else {
            for (const method of value.values()) {
                testMethods.push([method]);
            }
        }
    }

    return [[...classMapping.values()], ...testMethods];
}

function mapTestItemsByProject(items: TestItem[]): Map<string, TestItem[]> {
    const map: Map<string, TestItem[]> = new Map<string, TestItem[]>();
    for (const item of items) {
        const projectName: string | undefined = dataCache.get(item)?.projectName;
        if (!projectName) {
            sendError(new Error('Item does not have project name.'));
            continue;
        }
        const itemsPerProject: TestItem[] | undefined = map.get(projectName);
        if (itemsPerProject) {
            itemsPerProject.push(item);
        } else {
            map.set(projectName, [item]);
        }
    }
    return map;
}

function mapTestItemsByKind(items: TestItem[]): Map<TestKind, TestItem[]> {
    const map: Map<TestKind, TestItem[]> = new Map<TestKind, TestItem[]>();
    for (const item of items) {
        const testKind: TestKind | undefined = dataCache.get(item)?.testKind;
        if (testKind === undefined) {
            continue;
        }
        const itemsPerKind: TestItem[] | undefined = map.get(testKind);
        if (itemsPerKind) {
            itemsPerKind.push(item);
        } else {
            map.set(testKind, [item]);
        }
    }
    return map;
}

function getRunnerByContext(testContext: IRunTestContext): BaseRunner | undefined {
    switch (testContext.kind) {
        case TestKind.JUnit:
        case TestKind.JUnit5:
            return new JUnitRunner(testContext);
        case TestKind.TestNG:
            return new TestNGRunner(testContext);
        default:
            return undefined;
    }
}

interface IRunOption {
    isDebug: boolean;
    progressReporter?: IProgressReporter;
    onProgressCancelHandler?: Disposable;
    launchConfiguration?: DebugConfiguration;
    token?: CancellationToken;
}
