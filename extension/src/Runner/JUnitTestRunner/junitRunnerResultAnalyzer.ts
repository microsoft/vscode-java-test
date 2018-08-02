// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestResult, TestStatus } from '../../Models/protocols';
import * as Logger from '../../Utils/Logger/logger';
import { ITestInfo, ITestResult } from '../testModel';
import { JarFileRunnerResultAnalyzer } from '../JarFileRunner/jarFileRunnerResultAnalyzer';

const SUITE_START: string = 'testSuiteStarted';
const SUITE_FINISH: string = 'testSuiteFinished';
const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class JUnitRunnerResultAnalyzer extends JarFileRunnerResultAnalyzer {
    public static regex: RegExp = /@@<RunnerOutput-({[\s\S]*})-RunnerOutput>@@/gm;
    private _suiteName: string;

    public analyzeData(data: string): void {
        let match;
        do {
            match = JUnitRunnerResultAnalyzer.regex.exec(data);
            if (match) {
                try {
                    this.analyzeDataCore(match[1]);
                } catch (ex) {
                    Logger.error(`Failed to analyze runner output data. Data: ${match[1]}.`, {
                        error: ex,
                    });
                }
            }
        } while (match);
    }

    public analyzeError(error: string): void {
        let match;
        do {
            match = JUnitRunnerResultAnalyzer.regex.exec(error);
            if (match) {
                try {
                    const info = JSON.parse(match[1]) as JUnitTestResultInfo;
                    Logger.error(`Error occurred: ${match[1]}`);
                } catch (ex) {
                    // ignore error output by tests.
                }
            }
        } while (match);
    }

    public feedBack(isCancelled: boolean): ITestResult[] {
        const toAggregate = new Set();
        const result: ITestResult[] = [];
        this._tests.forEach((t) => {
            if (t.level === TestLevel.Class) {
                t.children.forEach((c) => this.processMethod(c, result, isCancelled));
            } else {
                this.processMethod(t, result, isCancelled);
            }
        });
        return result;
    }

    private analyzeDataCore(match: string) {
        let res;
        const info = JSON.parse(match) as JUnitTestResultInfo;
        switch (info.phase) {
            case SUITE_START :
                this._suiteName = info.attributes.name;
                break;
            case SUITE_FINISH:
                this._suiteName = undefined;
                break;
            case TEST_START:
                this._testResults.set(this._suiteName + '#' + info.attributes.name, {
                    status: undefined,
                });
                break;
            case TEST_FAIL:
                res = this._testResults.get(this._suiteName + '#' + info.attributes.name);
                if (!res) {
                    return;
                }
                res.status = TestStatus.Fail;
                res.message = this.decodeContent(info.attributes.message);
                res.details = this.decodeContent(info.attributes.details);
                break;
            case TEST_FINISH:
                res = this._testResults.get(this._suiteName + '#' + info.attributes.name);
                if (!res) {
                    return;
                }
                if (!res.status) {
                    res.status = TestStatus.Pass;
                }
                res.duration = info.attributes.duration;
                break;
        }
    }

    private processMethod(t: ITestInfo, result: ITestResult[], isCancelled: boolean): void {
        if (!this._testResults.has(t.test)) {
            if (isCancelled) {
                return;
            }
            this._testResults.set(t.test, {
                status: TestStatus.Skipped,
            });
        }
        result.push({
            test: t.test,
            uri: t.uri,
            result: this._testResults.get(t.test),
        });
    }

    private decodeContent(content: string): string {
        if (!content) {
            return content;
        }
        return content.replace(new RegExp('&#x40;', 'gm'), '@');
    }
}

export type JUnitTestResultInfo = {
    type: TestOutputType;
    phase: string;
    attributes: JUnitTestAttributes;
    message: string;
    stacktrace: string;
};

export type JUnitTestAttributes = {
    name: string;
    duration: string;
    location: string;
    message: string;
    details: string;
};

export enum TestOutputType {
    Info,
    Error,
}
