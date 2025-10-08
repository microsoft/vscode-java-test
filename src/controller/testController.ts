// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import * as path from 'path';
import { CancellationToken, DebugConfiguration, Disposable, FileCoverage, FileCoverageDetail, FileSystemWatcher, Location, MarkdownString, RelativePattern, TestController, TestItem, TestMessage, TestRun, TestRunProfileKind, TestRunRequest, tests, TestTag, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { instrumentOperation, sendError, sendInfo } from 'vscode-extension-telemetry-wrapper';
import { refreshExplorer } from '../commands/testExplorerCommands';
import { IProgressReporter } from '../debugger.api';
import { progressProvider } from '../extension';
import { testSourceProvider } from '../provider/testSourceProvider';
import { BaseRunner } from '../runners/baseRunner/BaseRunner';
import { JUnitRunner } from '../runners/junitRunner/JunitRunner';
import { TestNGRunner } from '../runners/testngRunner/TestNGRunner';
import { IJavaTestItem } from '../types';
import { loadRunConfig } from '../utils/configUtils';
import { resolveLaunchConfigurationForRunner } from '../utils/launchUtils';
import { dataCache, ITestItemData } from './testItemDataCache';
import { createTestItem, findDirectTestChildrenForClass, findTestPackagesAndTypes, findTestTypesAndMethods, loadJavaProjects, resolvePath, synchronizeItemsRecursively, updateItemForDocumentWithDebounce } from './utils';
import { JavaTestCoverageProvider } from '../provider/JavaTestCoverageProvider';
import { testRunnerService } from './testRunnerService';
import { IRunTestContext, TestRunner, TestFinishEvent, TestItemStatusChangeEvent, TestKind, TestLevel, TestResultState, TestIdParts } from '../java-test-runner.api';
import { processStackTraceLine } from '../runners/utils';
import { parsePartsFromTestId } from '../utils/testItemUtils';
import { TestReportGenerator } from '../reports/TestReportGenerator';

export let testController: TestController | undefined;
export const watchers: Disposable[] = [];
export const runnableTag: TestTag = new TestTag('runnable');

export function createTestController(): void {
    testController?.dispose();
    testController = tests.createTestController('java', 'Java Test');

    testController.resolveHandler = async (item: TestItem) => {
        await loadChildren(item);
    };

    testController.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandler, true, runnableTag);
    testController.createRunProfile('Debug Tests', TestRunProfileKind.Debug, runHandler, true, runnableTag);
    testController.createRunProfile('Run Tests with Coverage', TestRunProfileKind.Coverage, runHandler, true, runnableTag);

    testController.refreshHandler = () => {
        refreshExplorer();
    }

    startWatchingWorkspace();
}

export function creatTestProfile(name: string, kind: TestRunProfileKind): void {
    testController?.createRunProfile(name, kind, runHandler, false, runnableTag);
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
        profile: request.profile?.label ?? 'UNKNOWN',
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
    const reportGenerator = new TestReportGenerator();
    let coverageProvider: JavaTestCoverageProvider | undefined;
    if (request.profile?.kind === TestRunProfileKind.Coverage) {
        coverageProvider = new JavaTestCoverageProvider();
        request.profile.loadDetailedCoverage = (_testRun: TestRun, fileCoverage: FileCoverage, _token: CancellationToken): Promise<FileCoverageDetail[]> => {
            return Promise.resolve(coverageProvider!.getCoverageDetails(fileCoverage.uri));
        };
    }

    try {
        await new Promise<void>(async (resolve: () => void): Promise<void> => {
            const token: CancellationToken = option.token ?? run.token;
            let disposables: Disposable[] = [];
            token.onCancellationRequested(() => {
                option.progressReporter?.done();
                run.end();
                disposables.forEach((d: Disposable) => d.dispose());
                return resolve();
            });
            enqueueTestMethods(testItems, run);
            // TODO: first group by project, then merge test methods.
            const queue: TestItem[][] = mergeTestMethods(testItems);
            for (const testsInQueue of queue) {
                if (testsInQueue.length === 0) {
                    continue;
                }
                const testProjectMapping: Map<string, TestItem[]> = mapTestItemsByProject(testsInQueue);
                for (const [projectName, itemsPerProject] of testProjectMapping.entries()) {
                    const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(itemsPerProject[0].uri!);
                    if (!workspaceFolder) {
                        window.showErrorMessage(`Failed to get workspace folder from test item: ${itemsPerProject[0].label}.`);
                        continue;
                    }
                    const testContext: IRunTestContext = {
                        isDebug: option.isDebug,
                        kind: TestKind.None,
                        projectName,
                        testItems: itemsPerProject,
                        testRun: run,
                        workspaceFolder,
                        profile: request.profile,
                        testConfig: await loadRunConfig(itemsPerProject, workspaceFolder),
                    };
                    const testRunner: TestRunner | undefined = testRunnerService.getRunner(request.profile?.label, request.profile?.kind);
                    if (testRunner) {
                        await executeWithTestRunner(option, testRunner, testContext, run, disposables, reportGenerator);
                        disposables.forEach((d: Disposable) => d.dispose());
                        disposables = [];
                        continue;
                    }
                    const testKindMapping: Map<TestKind, TestItem[]> = mapTestItemsByKind(itemsPerProject);
                    for (const [kind, items] of testKindMapping.entries()) {
                        testContext.kind = kind;
                        testContext.testItems = items;
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
                        if (!testContext.testConfig) {
                            continue;
                        }
                        const runner: BaseRunner | undefined = getRunnerByContext(testContext);
                        if (!runner) {
                            window.showErrorMessage(`Failed to get suitable runner for the test kind: ${testContext.kind}.`);
                            continue;
                        }
                        try {
                            await runner.setup();
                            runner.setReportGenerator(reportGenerator);
                            const resolvedConfiguration: DebugConfiguration = mergeConfigurations(option.launchConfiguration, testContext.testConfig) ?? await resolveLaunchConfigurationForRunner(runner, testContext, testContext.testConfig);
                            resolvedConfiguration.__progressId = option.progressReporter?.getId();
                            delegatedToDebugger = true;
                            trackTestFrameworkVersion(testContext.kind, resolvedConfiguration.classPaths, resolvedConfiguration.modulePaths);
                            await runner.run(resolvedConfiguration, token, option.progressReporter);
                        } catch (error) {
                            window.showErrorMessage(error.message || 'Failed to run tests.');
                            option.progressReporter?.done();
                        } finally {
                            await runner.tearDown();
                        }
                    }
                    if (request.profile?.kind === TestRunProfileKind.Coverage) {
                        await coverageProvider!.provideFileCoverage(run, projectName);
                    }
                }
            }
            return resolve();
        });
    } finally {
        run.end();
        await reportGenerator.generateReport();
    }
});

async function executeWithTestRunner(option: IRunOption, testRunner: TestRunner, testContext: IRunTestContext, run: TestRun, disposables: Disposable[], reportGenerator: TestReportGenerator) {
    option.progressReporter?.done();
    await new Promise<void>(async (resolve: () => void): Promise<void> => {
        disposables.push(testRunner.onDidChangeTestItemStatus((event: TestItemStatusChangeEvent) => {
            const parts: TestIdParts = parsePartsFromTestId(event.testId);
            let parentItem: TestItem;
            try {
                parentItem = findTestClass(parts);
            } catch (e) {
                sendError(e);
                window.showErrorMessage(e.message);
                return resolve();
            }
            let currentItem: TestItem | undefined;
            const invocations: string[] | undefined = parts.invocations;
            if (invocations?.length) {
                let i: number = 0;
                for (; i < invocations.length; i++) {
                    currentItem = parentItem.children.get(`${parentItem.id}#${invocations[i]}`);
                    if (!currentItem) {
                        break;
                    }
                    parentItem = currentItem;
                }

                if (i < invocations.length - 1) {
                    window.showErrorMessage('Test not found:' + event.testId);
                    sendError(new Error('Test not found:' + event.testId));
                    return resolve();
                }

                if (!currentItem) {
                    currentItem = createTestItem({
                        children: [],
                        uri: parentItem.uri?.toString(),
                        range: parentItem.range,
                        jdtHandler: '',
                        fullName: `${parentItem.id}#${invocations[invocations.length - 1]}`,
                        label: event.displayName || invocations[invocations.length - 1],
                        id: `${parentItem.id}#${invocations[invocations.length - 1]}`,
                        projectName: testContext.projectName,
                        testKind: TestKind.None,
                        testLevel: TestLevel.Invocation,
                    }, parentItem);
                }
            } else {
                currentItem = parentItem;
            }

            if (event.displayName && getLabelWithoutCodicon(currentItem.label) !== event.displayName) {
                currentItem.description = event.displayName;
            }
            switch (event.state) {
                case TestResultState.Running:
                    run.started(currentItem);
                    reportGenerator.recordStarted(currentItem);
                    break;
                case TestResultState.Passed:
                    run.passed(currentItem, event.duration);
                    reportGenerator.recordPassed(currentItem, event.duration);
                    break;
                case TestResultState.Failed:
                case TestResultState.Errored:
                    const testMessages: TestMessage[] = [];
                    if (event.message) {
                        const markdownTrace: MarkdownString = new MarkdownString();
                        markdownTrace.supportHtml = true;
                        markdownTrace.isTrusted = true;
                        const testMessage: TestMessage = new TestMessage(markdownTrace);
                        testMessages.push(testMessage);
                        const lines: string[] = event.message.split(/\r?\n/);
                        for (const line of lines) {
                            const location: Location | undefined = processStackTraceLine(line, markdownTrace, currentItem, testContext.projectName);
                            if (location) {
                                testMessage.location = location;
                            }
                        }
                    }
                    run.failed(currentItem, testMessages, event.duration);
                    if (event.state === TestResultState.Failed) {
                        reportGenerator.recordFailed(currentItem, event.duration, event.message);
                    } else {
                        reportGenerator.recordErrored(currentItem, event.duration, event.message);
                    }
                    break;
                case TestResultState.Skipped:
                    run.skipped(currentItem);
                    reportGenerator.recordSkipped(currentItem);
                    break;
                default:
                    break;
            }
        }));

        disposables.push(testRunner.onDidFinishTestRun((event: TestFinishEvent) => {
            if (event.statusCode === 2) { // See: https://build-server-protocol.github.io/docs/specification#statuscode
                window.showErrorMessage(event.message ?? 'Failed to run tests.');
            }
            return resolve();
        }));

        await testRunner.launch(testContext);
    });

    function findTestClass(parts: TestIdParts): TestItem {
        const projectItem: TestItem | undefined = testController?.items.get(parts.project);
        if (!projectItem) {
            throw new Error('Failed to get the project test item.');
        }

        if (parts.package === undefined) { // '' means default package
            throw new Error('package is undefined in the id parts.');
        }

        const packageItem: TestItem | undefined = projectItem.children.get(`${projectItem.id}@${parts.package}`);
        if (!packageItem) {
            throw new Error('Failed to get the package test item.');
        }

        if (!parts.class) {
            throw new Error('class is undefined in the id parts.');
        }

        const classes: string[] = parts.class.split('$'); // handle nested classes
        let current: TestItem | undefined = packageItem.children.get(`${projectItem.id}@${classes[0]}`);
        if (!current) {
            throw new Error('Failed to get the class test item.');
        }
        for (let i: number = 1; i < classes.length; i++) {
            current = current.children.get(`${current.id}$${classes[i]}`);
            if (!current) {
                throw new Error('Failed to get the class test item.');
            }
        }
        return current;
    }
}

function mergeConfigurations(launchConfiguration: DebugConfiguration | undefined, config: any): DebugConfiguration | undefined {
    if (!launchConfiguration) {
        return undefined;
    }

    const entryKeys: string[] = Object.keys(config);
    for (const configKey of entryKeys) {
        // for now we merge launcher properties which doesn't have a value.
        if (!launchConfiguration[configKey]) {
            launchConfiguration[configKey] = config[configKey];
        }
    }
    return launchConfiguration;
}

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
    testItems = handleInvocations(testItems);
    testItems = await expandTests(testItems, TestLevel.Class, token);
    // @ts-expect-error: ignore
    const excludingItems: TestItem[] = await expandTests(request.exclude || [], TestLevel.Class, token);
    testItems = _.differenceBy(testItems, excludingItems, 'id');
    return testItems;
}

/**
 * Check and preparation in case a single invocation of a parameterized test is re-run.
 * If a test is run completely, existing invocations are removed.
 * @param testItems
 * @returns prepared testItems
 */
export function handleInvocations(testItems: TestItem[]): TestItem[] { // export for unit test

    if (filterInvocations(testItems)
        .some((invocation: TestItem) => !invocation.parent || !dataCache.get(invocation.parent))) { // sanity-checks
        const errMsg: string = 'Trying to re-run a single test invocation, but could not find a corresponding method-level parent item with data.';
        sendError(new Error(errMsg));
        window.showErrorMessage(errMsg);
        return [];
    }

    testItems = mergeInvocations(testItems);

    const invocations: TestItem[] = filterInvocations(testItems);
    if (invocations.length > _.uniq(invocations.map((item: TestItem) => item.parent)).length) {
        window.showErrorMessage('Re-running multiple invocations of a parameterized test is not supported, please select only one invocation at a time.');
        return [];
    }

    // always remove uniqueIds from all non-invocation items, since they would have been set for a past run
    testItems.forEach((item: TestItem) => {
        const itemData: ITestItemData | undefined = dataCache.get(item);
        if (itemData && itemData.testLevel !== TestLevel.Invocation) {
            itemData.uniqueId = undefined;
        }
    });

    // if a single invocation is to be re-run,
    // we run the parent method instead, but with restriction to the single invocation parameter-set
    testItems = testItems.map((item: TestItem) => {
        if (isInvocation(item)) {
            dataCache.get(item.parent!)!.uniqueId = dataCache.get(item)!.uniqueId;
            return item.parent!;
        }
        return item;
    })

    removeNonRerunTestInvocations(testItems);
    return testItems;
}

function filterInvocations(testItems: TestItem[]): TestItem[] {
    return testItems.filter((item: TestItem) => isInvocation(item));
}

function isInvocation(item: TestItem): boolean {
    return dataCache.get(item)?.testLevel === TestLevel.Invocation;
}

function mergeInvocations(testItems: TestItem[]): TestItem[] {
    // remove invocations if they are already included in selected higher-level tests
    testItems = testItems.filter((item: TestItem) => !(isInvocation(item) && isAncestorIncluded(item, testItems)));

    // if all invocations of a method are selected, replace by single parent method run
    const invocationsPerMethod: Map<TestItem, Set<TestItem>> = filterInvocations(testItems)
        /* eslint-disable @typescript-eslint/typedef */
        .reduce(
            (map, inv) => map.set(inv.parent!,
                map.has(inv.parent!) ? new Set([...map.get(inv.parent!)!, inv]) : new Set([inv])),
            new Map()
        );
    const invocationsToMerge: TestItem[] = _.flatten([...invocationsPerMethod.entries()]
        .filter(([method, invs]) => method.children.size === invs.size)
        .map(([, invs]) => [...invs]));
        /* eslint-enable @typescript-eslint/typedef */
    return _.uniq(testItems.map((item: TestItem) => invocationsToMerge.includes(item) ? item.parent! : item));
}

function isAncestorIncluded(item: TestItem, potentialAncestors: TestItem[]): boolean {
    // walk up the tree and check whether any ancestor is part of the selected test items
    let parent: TestItem | undefined = item.parent;
    while (parent !== undefined) {
        if (potentialAncestors.includes(parent)) {
            return true;
        }
        parent = parent.parent;
    }
    return false;
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
 * Remove the test invocations since they might be changed, except for methods where only a single invocation is re-run.
 */
function removeNonRerunTestInvocations(testItems: TestItem[]): void {
    const rerunMethods: TestItem[] = testItems.filter((item: TestItem) => dataCache.get(item)?.uniqueId !== undefined);
    const queue: TestItem[] = [...testItems];
    while (queue.length) {
        const item: TestItem = queue.shift()!;
        if (rerunMethods.includes(item)) {
            continue;
        }
        if (dataCache.get(item)?.testLevel === TestLevel.Invocation) {
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
    if (testItems.length <= 1) {
        return [testItems];
    }
    // eslint-disable-next-line @typescript-eslint/typedef
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

    // eslint-disable-next-line @typescript-eslint/typedef
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

    for (const [clazz, methods] of testMapping) {
        // if all methods of a class are selected, prefer running the class instead, to execute them together
        if (clazz.children.size === methods.size
            // but do not run the whole class when a method is restricted to a single invocation,
            // since restricting class items to single invocations is not supported
            && !([...methods].some((m: TestItem) => dataCache.get(m)?.uniqueId))) {
            classMapping.set(clazz.id, clazz);
        } else {
            for (const method of methods.values()) {
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

function trackTestFrameworkVersion(testKind: TestKind, classpaths: string[], modulepaths: string[]) {
    let artifactPattern: RegExp;
    switch (testKind) {
        case TestKind.JUnit:
            artifactPattern = /junit-(\d+\.\d+\.\d+(-[a-zA-Z\d]+)?).jar/;
            break;
        case TestKind.JUnit5:
            artifactPattern = /junit-jupiter-api-(\d+\.\d+\.\d+(-[a-zA-Z\d]+)?).jar/;
            break;
        case TestKind.TestNG:
            artifactPattern = /testng-(\d+\.\d+\.\d+(-[a-zA-Z\d]+)?).jar/;
            break;
        default:
            return;
    }
    let version: string = 'unknown';
    for (const entry of [...classpaths, ...modulepaths]) {
        const fileName: string = path.basename(entry);
        const match: RegExpMatchArray | null = artifactPattern.exec(fileName);
        if (match) {
            version = match[1];
            break;
        }
    }
    sendInfo('', {
        testFramework: TestKind[testKind],
        frameworkVersion: version
    });
}

function getLabelWithoutCodicon(name: string): string {
    if (name.includes('#')) {
        name = name.substring(name.indexOf('#') + 1);
    }

    const result: RegExpMatchArray | null = name.match(/(?:\$\(.+\) )?(.*)/);
    if (result?.length === 2) {
        return result[1];
    }
    return name;
}

interface IRunOption {
    isDebug: boolean;
    progressReporter?: IProgressReporter;
    onProgressCancelHandler?: Disposable;
    launchConfiguration?: DebugConfiguration;
    token?: CancellationToken;
}
