// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, ExtensionContext, Progress, ProgressLocation, window } from 'vscode';
import { testCodeLensProvider } from '../codeLensProvider';
import { logger } from '../logger/logger';
import { ITestItem, TestKind } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { testConfigManager } from '../testConfigManager';
import { testReportProvider } from '../testReportProvider';
import { testResultManager } from '../testResultManager';
import { testStatusBarProvider } from '../testStatusBarProvider';
import { ITestRunner } from './ITestRunner';
import { JUnit4Runner } from './junit4Runner/Junit4Runner';
import { JUnit5Runner } from './junit5Runner/JUnit5Runner';
import { ITestResult } from './models';
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
                const config: IExecutionConfig | undefined = await testConfigManager.loadRunConfig(tests, isDebug);
                if (!config) {
                    logger.info('Test job is canceled.');
                    continue;
                }
                await window.withProgress(
                    { location: ProgressLocation.Notification, cancellable: true },
                    async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                        token.onCancellationRequested(() => {
                            this.cleanUp(true /* isCancel */);
                        });
                        await runner.setup(tests, isDebug, config);
                        testStatusBarProvider.showRunningTest();
                        progress.report({ message: 'Running tests...'});
                        await runner.execPreLaunchTaskIfExist();
                        if (token.isCancellationRequested) {
                            return;
                        }
                        const results: ITestResult[] = await runner.run();
                        testResultManager.storeResult(...results);
                        finalResults.push(...results);
                    },
                );
            }
        } catch (error) {
            window.showErrorMessage(`${error}`);
            testStatusBarProvider.showFailure();
        } finally {
            testStatusBarProvider.showTestResult(finalResults);
            testCodeLensProvider.refresh();
            testReportProvider.update(finalResults);
            await this.cleanUp(false);
        }
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        try {
            this._isRunning = false;
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
}

export const runnerExecutor: RunnerExecutor = new RunnerExecutor();
