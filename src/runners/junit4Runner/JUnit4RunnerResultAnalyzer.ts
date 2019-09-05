// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResultDetails, TestStatus } from '../models';

export class JUnit4RunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

    private currentTestItem: string;
    private traces: string;
    private isRecordingTraces: boolean;

    public analyzeData(data: string): void {
        const lines: string[] = data.split(/\r?\n/);
        for (const line of lines) {
            if (!line) {
                continue;
            }
            this.processData(line);
            logger.verbose(line + '\n');
        }
    }

    protected processData(data: string): void {
        if (data.startsWith(MessageId.TestStart)) {
            const testFullName: string = getTestFullName(data);
            if (testFullName) {
                this.currentTestItem = testFullName;
                this.testResults.set(testFullName, {
                    status: undefined,
                });
            }
        } else if (data.startsWith(MessageId.TestEnd)) {
            const testFullName: string = getTestFullName(data);
            if (testFullName) {
                const finishedResult: ITestResultDetails | undefined = this.testResults.get(testFullName);
                if (!finishedResult) {
                    return;
                }
                if (!finishedResult.status) {
                    finishedResult.status = TestStatus.Pass;
                }
            }
        } else if (data.startsWith(MessageId.TestFailed) || data.startsWith(MessageId.TestError)) {
            const testFullName: string = getTestFullName(data);
            if (testFullName) {
                this.currentTestItem = testFullName;
                const failedResult: ITestResultDetails | undefined = this.testResults.get(testFullName);
                if (!failedResult) {
                    return;
                }
                failedResult.status = TestStatus.Fail;
            }
        } else if (data.startsWith(MessageId.TraceStart)) {
            this.traces = '';
            this.isRecordingTraces = true;
        } else if (data.startsWith(MessageId.TraceEnd)) {
            const failedResult: ITestResultDetails | undefined = this.testResults.get(this.currentTestItem);
            if (!failedResult) {
                    return;
                }
            failedResult.trace = this.traces;
            this.isRecordingTraces = false;
        } else if (this.isRecordingTraces) {
            this.traces += data + '\n';
        }
    }
}

function getTestFullName(message: string): string {
    const regexp: RegExp = /\d+,(.*?)\((.*?)\)/g;
    const matchResults: RegExpExecArray | null = regexp.exec(message); {
        if (!matchResults || matchResults.length <= 2) {
            logger.error(`Failed to parse the message: ${message}`);
            return '';
        }
        return `${matchResults[2]}#${matchResults[1]}`;
    }
}

enum MessageId {
    TestStart = '%TESTS',
    TestEnd = '%TESTE',
    TestFailed = '%FAILED',
    TestError = '%ERROR',
    TraceStart = '%TRACES',
    TraceEnd = '%TRACEE',
}
