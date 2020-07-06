// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration, ExtensionContext, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { testCodeLensController } from '../codelens/TestCodeLensController';
import { ReportShowSetting } from '../constants/configs';
import { logger } from '../logger/logger';
import { ITestItem, TestKind } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { testReportProvider } from '../testReportProvider';
import { testResultManager } from '../testResultManager';
import { testStatusBarProvider } from '../testStatusBarProvider';
import { loadRunConfig } from '../utils/configUtils';
import { resolveLaunchConfigurationForRunner } from '../utils/launchUtils';
import { getShowReportSetting } from '../utils/settingUtils';
import * as uiUtils from '../utils/uiUtils';
import { BaseRunner } from './baseRunner/BaseRunner';
import { JUnitRunner } from './junitRunner/JunitRunner';
import { IRunnerContext, ITestResult, TestStatus } from './models';
import { TestNGRunner } from './testngRunner/TestNGRunner';

class RunnerScheduler {
    private _context: ExtensionContext;
    private _isRunning: boolean;
    private _runnerMap: Map<BaseRunner, ITestItem[]> | undefined;
    private _executionCache: IExecutionCache;

    public initialize(context: ExtensionContext): void {
        this._context = context;
    }

    public async run(runnerContext: IRunnerContext, launchConfiguration?: DebugConfiguration): Promise<void> {
        if (this._isRunning) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            return;
        }

        this._isRunning = true;
        this._executionCache = Object.assign({}, {context: runnerContext});
        let allIds: Set<string> = new Set<string>();

        try {
            this._runnerMap = this.classifyTestsByKind(runnerContext.tests);
            for (const [runner, tests] of this._runnerMap.entries()) {
                runnerContext.kind = tests[0].kind;
                runnerContext.projectName = tests[0].project;
                runnerContext.tests = tests;
                // The test items that belong to a test runner, here the test items should be in the same workspace folder.
                const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(tests[0].location.uri));
                const config: IExecutionConfig | undefined = await loadRunConfig(workspaceFolder);
                if (!config) {
                    logger.info('Test job is canceled.');
                    continue;
                }

                await runner.setup(runnerContext);
                testStatusBarProvider.showRunningTest();
                const ids: Set<string> = await runner.run(launchConfiguration || await resolveLaunchConfigurationForRunner(runner, runnerContext, config));
                allIds = new Set([...allIds, ...ids]);
            }
            const finalResults: ITestResult[] = testResultManager.getResultsByIds(Array.from(allIds));
            testStatusBarProvider.showTestResult(finalResults);
            testCodeLensController.refresh();
            this.showReportIfNeeded(finalResults);
            this._executionCache.results = finalResults;
        } catch (error) {
            logger.error(error.toString());
            uiUtils.showError(error);
        } finally {
            await this.cleanUp(false);
        }
    }

    public getExecutionCache(): IExecutionCache {
        return this._executionCache;
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        try {
            const promises: Array<Promise<void>> = [];
            if (this._runnerMap) {
                for (const runner of this._runnerMap.keys()) {
                    promises.push(runner.tearDown());
                }
                this._runnerMap.clear();
                this._runnerMap = undefined;
            }
            await Promise.all(promises);

            if (isCancel) {
                logger.info('Test job is canceled.');
            }
        } catch (error) {
            logger.error('Failed to clean up', error);
        }
        this._isRunning = false;
    }

    private classifyTestsByKind(tests: ITestItem[]): Map<BaseRunner, ITestItem[]> {
        const testMap: Map<string, ITestItem[]> = this.mapTestsByProjectAndKind(tests);
        return this.mapTestsByRunner(testMap);
    }

    private mapTestsByProjectAndKind(tests: ITestItem[]): Map<string, ITestItem[]> {
        const map: Map<string, ITestItem[]> = new Map<string, ITestItem[]>();
        // Store all the covered test items, e.g. if a class will be run, all the child method will be added into it
        const coveredSet: Set<string> = new Set<string>();
        for (const test of tests) {
            if (coveredSet.has(test.id)) {
                continue;
            }
            if (!(test.kind in TestKind)) {
                logger.error(`Unknown kind of test item: ${test.fullName}`);
                continue;
            }
            const key: string = `${test.project}/${test.kind}`;
            const testArray: ITestItem[] | undefined = map.get(key);
            if (testArray) {
                testArray.push(test);
            } else {
                map.set(key, [test]);
            }
            coveredSet.add(test.id);
            if (test.children) {
                for (const childId of test.children) {
                    coveredSet.add(childId);
                }
            }
        }
        return map;
    }

    private mapTestsByRunner(testsPerProjectAndKind: Map<string, ITestItem[]>): Map<BaseRunner, ITestItem[]> {
        const map: Map<BaseRunner, ITestItem[]> = new Map<BaseRunner, ITestItem[]>();
        for (const tests of testsPerProjectAndKind.values()) {
            const runner: BaseRunner | undefined = this.getRunnerByKind(tests[0].kind);
            if (runner) {
                map.set(runner, tests);
            } else {
                window.showWarningMessage(`Cannot find matched runner to run the test: ${tests[0].kind}`);
            }
        }
        return map;
    }

    private getRunnerByKind(kind: TestKind): BaseRunner | undefined {
        switch (kind) {
            case TestKind.JUnit:
            case TestKind.JUnit5:
                return new JUnitRunner(this._context.extensionPath);
            case TestKind.TestNG:
                return new TestNGRunner(this._context.extensionPath);
            default:
                return undefined;
        }
    }

    private showReportIfNeeded(finalResults: ITestResult[]): void {
        if (finalResults.length === 0) {
            return;
        }

        const showSetting: string = getShowReportSetting();
        switch (showSetting) {
            case ReportShowSetting.Always:
                testReportProvider.report(finalResults);
                break;
            case ReportShowSetting.OnFail:
                const hasFailedTests: boolean = finalResults.some((result: ITestResult) => {
                    return result.status === TestStatus.Fail;
                });
                if (hasFailedTests) {
                    testReportProvider.report(finalResults);
                } else {
                    testReportProvider.update(finalResults);
                }
                break;
            case ReportShowSetting.Never:
                testReportProvider.update(finalResults);
                break;
            default:
                break;
        }
    }
}

export interface IExecutionCache {
    context: IRunnerContext;
    results?: ITestResult[];
}

export const runnerScheduler: RunnerScheduler = new RunnerScheduler();
