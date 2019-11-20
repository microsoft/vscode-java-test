// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResultDetails, TestStatus } from '../models';

export class JUnitRunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

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
            if (!testFullName) {
                return;
            }

            let detail: ITestResultDetails | undefined = this.testResults.get(testFullName);
            const start: number = Date.now();
            if (!detail) {
                this.currentTestItem = testFullName;
                detail = { status: undefined };
                if (data.indexOf(MessageId.IGNORE_TEST_PREFIX) > -1) {
                    detail.status = TestStatus.Skip;
                } else {
                    detail.duration = -start;
                }
                this.testResults.set(testFullName, detail);
            } else if (detail.duration !== undefined) {
                // Some test cases may executed multiple times (@RepeatedTest), we need to calculate the time for each execution
                detail.duration -= start;
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
                getElapsedTime(finishedResult);
            }
        } else if (data.startsWith(MessageId.TestFailed) || data.startsWith(MessageId.TestError)) {
            const testFullName: string = getTestFullName(data);
            if (testFullName) {
                this.currentTestItem = testFullName;
                const failedResult: ITestResultDetails | undefined = this.testResults.get(testFullName);
                if (!failedResult) {
                    return;
                }
                if (data.indexOf(MessageId.ASSUMPTION_FAILED_TEST_PREFIX) > -1) {
                    failedResult.status = TestStatus.Skip;
                    return;
                }
                failedResult.status = TestStatus.Fail;
                getElapsedTime(failedResult);
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

function getElapsedTime(detail: ITestResultDetails): void {
    if (detail.duration && detail.duration < 0) {
        const end: number = Date.now();
        detail.duration += end;
    }
}

function getTestFullName(message: string): string {
    const regexp: RegExp = /\d+,(@AssumptionFailure: |@Ignore: )?(.*?)\((.*?)\)/;
    const matchResults: RegExpExecArray | null = regexp.exec(message); {
        if (!matchResults || matchResults.length < 4) {
            logger.error(`Failed to parse the message: ${message}`);
            return '';
        }
        return `${matchResults[3]}#${matchResults[2]}`;
    }
}

enum MessageId {
    TestStart = '%TESTS',
    TestEnd = '%TESTE',
    TestFailed = '%FAILED',
    TestError = '%ERROR',
    TraceStart = '%TRACES',
    TraceEnd = '%TRACEE',
    IGNORE_TEST_PREFIX = '@Ignore: ',
    ASSUMPTION_FAILED_TEST_PREFIX = '@AssumptionFailure: ',
}
