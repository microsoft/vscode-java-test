// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, ExtensionContext, Progress, ProgressLocation, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { testCodeLensProvider } from '../codeLensProvider';
import { showOutputChannel } from '../commands/logCommands';
import { ReportShowSetting } from '../constants/configs';
import { OPEN_OUTPUT_CHANNEL } from '../constants/dialogOptions';
import { logger } from '../logger/logger';
import { ITestItem, TestKind } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { testReportProvider } from '../testReportProvider';
import { testResultManager } from '../testResultManager';
import { testStatusBarProvider } from '../testStatusBarProvider';
import { shouldEnablePreviewFlag } from '../utils/commandUtils';
import { loadRunConfig } from '../utils/configUtils';
import { getShowReportSetting, resolve } from '../utils/settingUtils';
import { ITestRunner } from './ITestRunner';
import { JUnit4Runner } from './junit4Runner/Junit4Runner';
import { JUnit5Runner } from './junit5Runner/JUnit5Runner';
import { ITestResult, TestStatus } from './models';
import { TestNGRunner } from './testngRunner/TestNGRunner';

class RunnerExecutor {
    private _javaHome: string;
    private _context: ExtensionContext;
    private _isRunning: boolean;
    private _runnerMap: Map<ITestRunner, ITestItem[]> | undefined;

    public initialize(javaHome: string, context: ExtensionContext): void {
        this._javaHome = javaHome;
        this._context = context;
    }

    public async run(testItems: ITestItem[], isDebug: boolean): Promise<void> {
        if (this._isRunning) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            return;
        }

        this._isRunning = true;
        const finalResults: ITestResult[] = [];
        try {
            this._runnerMap = this.classifyTestsByKind(testItems);
            for (const [runner, tests] of this._runnerMap.entries()) {
                // The test items that belong to a test runner, here the test items should be in the same workspace folder.
                const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(tests[0].location.uri));
                const config: IExecutionConfig | undefined = await loadRunConfig(workspaceFolder);
                if (!config) {
                    logger.info('Test job is canceled.');
                    continue;
                }

                // Auto add '--enable-preview' vmArgs if the java project enables COMPILER_PB_ENABLE_PREVIEW_FEATURES flag.
                if (await shouldEnablePreviewFlag('', tests[0].project)) {
                    if (config.vmargs) {
                        config.vmargs.push('--enable-preview');
                    } else {
                        config.vmargs = ['--enable-preview'];
                    }
                }

                await window.withProgress(
                    { location: ProgressLocation.Notification, cancellable: true },
                    async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                        token.onCancellationRequested(() => {
                            this.cleanUp(true /* isCancel */);
                        });
                        await runner.setup(tests, isDebug, resolve(config, Uri.parse(tests[0].location.uri)));
                        testStatusBarProvider.showRunningTest();
                        progress.report({ message: 'Running tests...'});
                        if (token.isCancellationRequested) {
                            return;
                        }
                        const results: ITestResult[] = await runner.run();
                        await testResultManager.storeResult(workspaceFolder as WorkspaceFolder, ...results);
                        finalResults.push(...results);
                    },
                );
            }
            testStatusBarProvider.showTestResult(finalResults);
            testCodeLensProvider.refresh();
            this.showReportIsNeeded(finalResults);
        } catch (error) {
            window.showErrorMessage(`${error}`, OPEN_OUTPUT_CHANNEL).then((choice: string | undefined) => {
                if (choice === OPEN_OUTPUT_CHANNEL) {
                    showOutputChannel();
                }
            });
            testStatusBarProvider.showFailure();
        } finally {
            await this.cleanUp(false);
        }
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        try {
            const promises: Array<Promise<void>> = [];
            if (this._runnerMap) {
                for (const runner of this._runnerMap.keys()) {
                    promises.push(runner.cleanUp(isCancel));
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

    private classifyTestsByKind(tests: ITestItem[]): Map<ITestRunner, ITestItem[]> {
        const testMap: Map<string, ITestItem[]> = this.mapTestsByProjectAndKind(tests);
        return this.mapTestsByRunner(testMap);
    }

    private mapTestsByProjectAndKind(tests: ITestItem[]): Map<string, ITestItem[]> {
        const map: Map<string, ITestItem[]> = new Map<string, ITestItem[]>();
        for (const test of tests) {
            if (!(test.kind in TestKind)) {
                logger.error(`Unkonwn kind of test item: ${test.fullName}`);
                continue;
            }
            const key: string = `${test.project}/${test.kind}`;
            const testArray: ITestItem[] | undefined = map.get(key);
            if (testArray) {
                testArray.push(test);
            } else {
                map.set(key, [test]);
            }
        }
        return map;
    }

    private mapTestsByRunner(testsPerProjectAndKind: Map<string, ITestItem[]>): Map<ITestRunner, ITestItem[]> {
        const map: Map<ITestRunner, ITestItem[]> = new Map<ITestRunner, ITestItem[]>();
        for (const tests of testsPerProjectAndKind.values()) {
            const runner: ITestRunner | undefined = this.getRunnerByKind(tests[0].kind);
            if (runner) {
                map.set(runner, tests);
            } else {
                window.showWarningMessage(`Cannot find matched runner to run the test: ${tests[0].kind}`);
            }
        }
        return map;
    }

    private getRunnerByKind(kind: TestKind): ITestRunner | undefined {
        switch (kind) {
            case TestKind.JUnit:
                return new JUnit4Runner(this._javaHome, this._context.storagePath, this._context.extensionPath);
            case TestKind.JUnit5:
                return new JUnit5Runner(this._javaHome, this._context.storagePath, this._context.extensionPath);
            case TestKind.TestNG:
                return new TestNGRunner(this._javaHome, this._context.storagePath, this._context.extensionPath);
            default:
                return undefined;
        }
    }

    private showReportIsNeeded(finalResults: ITestResult[]): void {
        const showSetting: string = getShowReportSetting();
        switch (showSetting) {
            case ReportShowSetting.Always:
                testReportProvider.report(finalResults);
                break;
            case ReportShowSetting.OnFail:
                const hasFailedTests: boolean = finalResults.some((result: ITestResult) => {
                    return result.details.status === TestStatus.Fail;
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

export const runnerExecutor: RunnerExecutor = new RunnerExecutor();
