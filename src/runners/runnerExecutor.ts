// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import { ExtensionContext, window } from 'vscode';
import { testCodeLensProvider } from '../codeLensProvider';
import { logger } from '../logger/logger';
import { ITestItem, TestKind } from '../protocols';
import { testReportProvider } from '../testReportProvider';
import { testResultManager } from '../testResultManager';
import { testStatusBarProvider } from '../testStatusBarProvider';
import { killProcess } from '../utils/cpUtils';
import { ITestRunner } from './ITestRunner';
import { JUnit4Runner } from './junit4Runner/Junit4Runner';
import { JUnit5Runner } from './junit5Runner/JUnit5Runner';
import { ITestResult } from './models';
import { TestNGRunner } from './testngRunner/TestNGRunner';

class RunnerExecutor {
    private _javaHome: string;
    private _context: ExtensionContext;
    private _isRunning: boolean;
    private _preLaunchTask: cp.ChildProcess | undefined;
    private _runnerMap: Map<ITestRunner, ITestItem[]> | undefined;

    public initialize(javaHome: string, context: ExtensionContext): void {
        this._javaHome = javaHome;
        this._context = context;
    }

    public async run(testItems: ITestItem[], isDebug: boolean = false): Promise<void> {
        if (this._isRunning) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            return;
        }

        if (testItems.length === 0) {
            logger.info('No test items found.');
            return;
        }

        this._isRunning = true;
        testStatusBarProvider.showRunningTest();
        try {
            this._runnerMap = this.classifyTestsByKind(testItems);
            const finalResults: ITestResult[] = [];
            for (const [runner, tests] of this._runnerMap.entries()) {
                await runner.setup(tests, isDebug);
                const results: ITestResult[] = await runner.run();
                testResultManager.storeResult(...results);
                finalResults.push(...results);
            }
            testStatusBarProvider.showTestResult(finalResults);
            testCodeLensProvider.refresh();
            testReportProvider.update(finalResults);
        } catch (error) {
            window.showErrorMessage(`${error}`);
            testStatusBarProvider.showFailure();
        } finally {
            await this.cleanUp(false);
        }
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        try {
            if (this._preLaunchTask) {
                await killProcess(this._preLaunchTask);
                this._preLaunchTask = undefined;
            }

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
            const key: string = test.project.concat(test.kind.toString());
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
