// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, commands, DebugConfiguration, ExtensionContext, Progress, ProgressLocation, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { testCodeLensController } from '../codelens/TestCodeLensController';
import { JavaLanguageServerCommands, JavaTestRunnerCommands } from '../constants/commands';
import { ReportShowSetting } from '../constants/configs';
import { logger } from '../logger/logger';
import { ITestItem, TestKind } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { testReportProvider } from '../testReportProvider';
import { testResultManager } from '../testResultManager';
import { testStatusBarProvider } from '../testStatusBarProvider';
import { getResolvedRunConfig } from '../utils/configUtils';
import { resolveLaunchConfigurationForRunner } from '../utils/launchUtils';
import { getShowReportSetting, needBuildWorkspace, needSaveAll } from '../utils/settingUtils';
import * as uiUtils from '../utils/uiUtils';
import { BaseRunner } from './baseRunner/BaseRunner';
import { JUnitRunner } from './junitRunner/JunitRunner';
import { IRunnerContext, ITestResult, TestStatus } from './models';
import { TestNGRunner } from './testngRunner/TestNGRunner';

class RunnerScheduler {
    private _javaHome: string;
    private _context: ExtensionContext;
    private _isRunning: boolean;
    private _runnerMap: Map<BaseRunner, ITestItem[]> | undefined;

    public initialize(javaHome: string, context: ExtensionContext): void {
        this._javaHome = javaHome;
        this._context = context;
    }

    public async run(testItems: ITestItem[], runnerContext: IRunnerContext, launchConfiguration?: DebugConfiguration): Promise<void> {
        if (this._isRunning) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            return;
        }

        this._isRunning = true;
        let finalResults: ITestResult[] = [];

        await this.saveFilesIfNeeded();

        if (needBuildWorkspace()) {
            try {
                // Directly call this Language Server command since we hard depend on it.
                await commands.executeCommand(JavaLanguageServerCommands.JAVA_BUILD_WORKSPACE, false /*incremental build*/);
            } catch (err) {
                const ans: string | undefined = await window.showErrorMessage(
                    'Build failed, do you want to continue?',
                    'Proceed',
                    'Abort');
                if (ans !== 'Proceed') {
                    return;
                }
            }
        }

        try {
            this._runnerMap = this.classifyTestsByKind(testItems);
            for (const [runner, tests] of this._runnerMap.entries()) {
                // The test items that belong to a test runner, here the test items should be in the same workspace folder.
                const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(tests[0].location.uri));
                const config: IExecutionConfig | undefined = await getResolvedRunConfig(workspaceFolder);
                if (!config) {
                    logger.info('Test job is canceled.');
                    continue;
                }

                await window.withProgress(
                    { location: ProgressLocation.Notification, cancellable: true },
                    async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                        return new Promise<void>(async (resolve: () => void, reject: (reason: any) => void): Promise<void> => {
                            try {
                                token.onCancellationRequested(() => {
                                    commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL);
                                    return resolve();
                                });
                                await runner.setup(tests);
                                testStatusBarProvider.showRunningTest();
                                progress.report({ message: 'Running tests...'});
                                if (token.isCancellationRequested) {
                                    return resolve();
                                }
                                const results: ITestResult[] = await runner.run(launchConfiguration || await resolveLaunchConfigurationForRunner(runner, tests, runnerContext, config));
                                await testResultManager.storeResult(workspaceFolder as WorkspaceFolder, ...results);
                                finalResults.push(...results);
                                return resolve();
                            } catch (error) {
                                logger.error(error.toString());
                                return reject(error);
                            }
                        });
                    },
                );
            }
            finalResults = _.uniqBy(finalResults, 'fullName');
            testStatusBarProvider.showTestResult(finalResults);
            testCodeLensController.refresh();
            this.showReportIfNeeded(finalResults);
        } catch (error) {
            uiUtils.showError(error);
        } finally {
            await this.cleanUp(false);
        }
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        try {
            const promises: Array<Promise<void>> = [];
            if (this._runnerMap) {
                for (const runner of this._runnerMap.keys()) {
                    promises.push(runner.tearDown(isCancel));
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

    private async saveFilesIfNeeded(): Promise<void> {
        if (needSaveAll()) {
            await workspace.saveAll();
        }
    }

    private classifyTestsByKind(tests: ITestItem[]): Map<BaseRunner, ITestItem[]> {
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
                return new JUnitRunner(this._javaHome, this._context.storagePath, this._context.extensionPath);
            case TestKind.TestNG:
                return new TestNGRunner(this._javaHome, this._context.storagePath, this._context.extensionPath);
            default:
                return undefined;
        }
    }

    private showReportIfNeeded(finalResults: ITestResult[]): void {
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

export const runnerScheduler: RunnerScheduler = new RunnerScheduler();
