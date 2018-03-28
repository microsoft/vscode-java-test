// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from '../classPathManager';
import { TestStatusBarProvider } from '../testStatusBarProvider';
import * as Configs from '../Constants/configs';
import { TestKind, TestLevel, TestResult, TestStatus, TestSuite } from '../Models/protocols';
import { RunConfig } from '../Models/testConfig';
import * as Logger from '../Utils/Logger/logger';
import { ITestResult } from './testModel';
import { ITestRunner } from './testRunner';
import { ITestRunnerParameters } from './testRunnerParameters';
import { JUnitTestRunner } from './JUnitTestRunner/junitTestRunner';

import * as cp from 'child_process';
import { window, EventEmitter } from 'vscode';

export class TestRunnerWrapper {
    public static registerRunner(kind: TestKind, runner: ITestRunner) {
        TestRunnerWrapper.runnerPool.set(kind, runner);
    }

    public static async run(tests: TestSuite[], isDebugMode: boolean, config: RunConfig): Promise<void> {
        if (TestRunnerWrapper.running) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            Logger.info('Skip this run cause we only support running one session at the same time');
            return;
        }
        TestRunnerWrapper.running = true;
        try {
            const runners: Map<ITestRunner, TestSuite[]> = TestRunnerWrapper.classifyTests(tests);
            await TestStatusBarProvider.getInstance().update(tests, (async () => {
                for (const [runner, t] of runners.entries()) {
                    if (config && config.preLaunchTask.length > 0) {
                        await this.execPreLaunchTask(config.workingDirectory, config.preLaunchTask);
                    }
                    const params = await runner.setup(t, isDebugMode, config);
                    const res = await runner.run(params);
                    this.updateTestStorage(t, res);
                    await runner.postRun();
                }
            })());
        } finally {
            TestRunnerWrapper.running = false;
        }
    }

    private static readonly runnerPool: Map<TestKind, ITestRunner> = new Map<TestKind, ITestRunner>();
    private static running: boolean = false;

    private static classifyTests(tests: TestSuite[]): Map<ITestRunner, TestSuite[]> {
        return tests.reduce((map, t) => {
            const runner = this.getRunner(t);
            if (runner === null) {
                Logger.warn(`Cannot find matched runner to run the test: ${t.test}`, {
                    test: t,
                });
                return map;
            }
            const collection: TestSuite[] = map.get(runner);
            if (!collection) {
                map.set(runner, [t]);
            } else {
                collection.push(t);
            }
            return map;
        }, new Map<ITestRunner, TestSuite[]>());
    }

    private static getRunner(test: TestSuite): ITestRunner {
        if (!TestRunnerWrapper.runnerPool.has(test.kind)) {
            return null;
        }
        return TestRunnerWrapper.runnerPool.get(test.kind);
    }

    private static updateTestStorage(tests: TestSuite[], result: ITestResult[]): void {
        const mapper = result.reduce((total, cur) => {
            total.set(cur.test, cur.result);
            return total;
        }, new Map<string, TestResult>());
        const classesInflucenced = [];
        const flattenedTests = new Set(tests.map((t) => [t, t.parent, ...(t.children || [])])
                                    .reduce((total, cur) => total.concat(cur), [])
                                    .filter((t) => t));
        flattenedTests.forEach((t) => {
            if (mapper.has(t.test)) {
                t.result = mapper.get(t.test);
            } else if (t.level === TestLevel.Class) {
                classesInflucenced.push(t);
            }
        });
        classesInflucenced.forEach((c) => this.processClass(c));
    }

    private static processClass(t: TestSuite): void {
        let passNum: number = 0;
        let failNum: number = 0;
        let skipNum: number = 0;
        let duration: number = 0;
        let notRun: boolean = false;
        for (const child of t.children) {
            if (!child.result) {
                notRun = true;
                continue;
            }
            duration += Number(child.result.duration);
            switch (child.result.status) {
                case TestStatus.Pass:
                    passNum++;
                    break;
                case TestStatus.Fail:
                    failNum++;
                    break;
                case TestStatus.Skipped:
                    skipNum++;
                    break;
            }
        }

        t.result = {
            status: notRun ? undefined : (skipNum === t.children.length ? TestStatus.Skipped : (failNum > 0 ? TestStatus.Fail : TestStatus.Pass)),
            summary: `Tests run: ${passNum + failNum}, Failures: ${failNum}, Skipped: ${skipNum}.`,
            duration: notRun ? undefined : duration.toString(),
        };
    }

    private static execPreLaunchTask(cwd: string, task: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const process = cp.exec(task, { maxBuffer: Configs.CHILD_PROCESS_MAX_BUFFER_SIZE, cwd });
            process.on('error', (err) => {
                Logger.error(
                    `Error occurred while executing prelaunch task. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`,
                    {
                        stack: err.stack,
                    });
                reject(err);
            });
            process.stderr.on('data', (data) => {
                Logger.error(`Error occurred: ${data.toString()}`);
            });
            process.stdout.on('data', (data) => {
                Logger.info(data.toString());
            });
            process.on('close', (signal) => {
                if (signal && signal !== 0) {
                    reject(`Prelaunch task exited with code ${signal}.`);
                } else {
                    resolve(signal);
                }
            });
        });
    }
}
