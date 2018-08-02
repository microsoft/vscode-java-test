// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestStatus  } from '../../Models/protocols';
import * as Logger from '../../Utils/Logger/logger';
import { ITestInfo, ITestResult } from '../testModel';
import { JarFileRunnerResultAnalyzer } from '../JarFileRunner/jarFileRunnerResultAnalyzer';

import * as path from 'path';

const TEST_START: string = 'testStarted';
const TEST_SKIP: string = 'testSkipped';
const TEST_FINISH: string = 'testFinished';

export class JUnit5RunnerResultAnalyzer extends JarFileRunnerResultAnalyzer {
    public static regex: RegExp = /@@<({[^@]*})>/gm;
    public analyzeData(data: string): void {
        let match;
        do {
            match = JUnit5RunnerResultAnalyzer.regex.exec(data);
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
        Logger.error(`Error occurred: ${error}`);
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
        const info = JSON.parse(match) as JUnit5TestResultInfo;
        if (info.attributes.type !== JUnit5TestType.TEST) {
            return;
        }
        switch (info.name) {
            case TEST_START:
                this._testResults.set(this.parseFullyQualifiedNameFromId(info.attributes.id), {
                    status: undefined,
                });
                break;
            case TEST_SKIP:
                res = this._testResults.set(this.parseFullyQualifiedNameFromId(info.attributes.id), {
                    status: TestStatus.Skipped,
                    details: this.decodeContent(info.attributes.details),
                });
                break;
            case TEST_FINISH:
                res = this._testResults.get(this.parseFullyQualifiedNameFromId(info.attributes.id));
                if (!res) {
                    return;
                }
                res.status = this.parseTestStatus(info.attributes.status);
                res.details = this.decodeContent(info.attributes.details);
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

    private parseFullyQualifiedNameFromId(id: string): string {
        if (!id) {
            return id;
        }
        const regex = /\[(engine|class|method):([^\]]*)\]/gm;
        let fullname = '';
        let match;
        do {
            match = regex.exec(id);
            if (match && match[1] !== 'engine') {
                let name: string = match[2];
                if (match[1] === 'method') {
                    const index = name.indexOf('(');
                    if (index !== -1) {
                        name = name.substring(0, index);
                    }
                }
                fullname = fullname === '' ? name : (match[1] === 'method' ? fullname + '#' + name : fullname + '.' + name);
            }
        } while (match);
        return fullname;
    }

    private parseTestStatus(status: JUnit5TestStatus): TestStatus {
        switch (status) {
            case JUnit5TestStatus.FAILED:
                return TestStatus.Fail;
            case JUnit5TestStatus.SUCCESSFUL:
                return TestStatus.Pass;
            case JUnit5TestStatus.ABORTED:
                return TestStatus.Skipped;
        }
    }
}

export type JUnit5TestResultInfo = {
    name: string;
    attributes: JUnit5TestAttributes;
};

export type JUnit5TestAttributes = {
    name: string;
    id: string;
    type: JUnit5TestType;
    duration: string;
    status: JUnit5TestStatus;
    message: string;
    details: string;
};

export enum JUnit5TestType {
    TEST = 'TEST',
    CONTAINER = 'CONTAINER',
}

export enum JUnit5TestStatus {
    FAILED = 'FAILED',
    SUCCESSFUL = 'SUCCESSFUL',
    ABORTED = 'ABORTED',
}
