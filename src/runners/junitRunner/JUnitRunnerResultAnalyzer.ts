// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { testResultManager } from '../../testResultManager';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResult, TestStatus } from '../models';

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
            const testId: string = this.getTestId(data);
            if (!testId) {
                return;
            }
            this.currentTestItem = testId;

            let result: ITestResult;
            if (this.testIds.has(testId)) {
                result = Object.assign({}, testResultManager.getResultById(testId), {
                    id: testId,
                    status: TestStatus.Running,
                });
            } else {
                // the test has not been executed in current test session.
                // create a new result object
                result = {
                    id: testId,
                    status: TestStatus.Running,
                };
                this.testIds.add(testId);
            }

            const start: number = Date.now();
            if (data.indexOf(MessageId.IGNORE_TEST_PREFIX) > -1) {
                result.status = TestStatus.Skip;
            } else if (result.duration === undefined) {
                result.duration = -start;
            } else if (result.duration >= 0) {
                // Some test cases may executed multiple times (@RepeatedTest), we need to calculate the time for each execution
                result.duration -= start;
            }
            testResultManager.storeResult(result);
        } else if (data.startsWith(MessageId.TestEnd)) {
            const testId: string = this.getTestId(data);
            if (testId) {
                const finishedResult: ITestResult | undefined = testResultManager.getResultById(testId);
                if (!finishedResult) {
                    return;
                }
                if (finishedResult.status === TestStatus.Running) {
                    if (finishedResult.trace) {
                        finishedResult.status = TestStatus.Fail;
                    } else {
                        finishedResult.status = TestStatus.Pass;
                    }
                }
                updateElapsedTime(finishedResult);
                testResultManager.storeResult(finishedResult);
            }
        } else if (data.startsWith(MessageId.TestFailed) || data.startsWith(MessageId.TestError)) {
            const testId: string = this.getTestId(data);
            if (testId) {
                this.currentTestItem = testId;
                const failedResult: ITestResult = Object.assign({}, testResultManager.getResultById(testId), {
                    id: testId,
                    status: data.indexOf(MessageId.ASSUMPTION_FAILED_TEST_PREFIX) > -1 ? TestStatus.Skip : TestStatus.Fail,
                });
                updateElapsedTime(failedResult);
                testResultManager.storeResult(failedResult);
                this.testIds.add(testId);
            }
        } else if (data.startsWith(MessageId.TraceStart)) {
            this.traces = '';
            this.isRecordingTraces = true;
        } else if (data.startsWith(MessageId.TraceEnd)) {
            const failedResult: ITestResult | undefined = testResultManager.getResultById(this.currentTestItem);
            if (!failedResult) {
                return;
            }
            failedResult.trace = this.traces;
            this.isRecordingTraces = false;
            testResultManager.storeResult(failedResult);
        } else if (this.isRecordingTraces) {
            this.traces += data + '\n';
        }
    }

    protected getTestId(message: string): string {
        /**
         * The following regex expression is used to parse the test runner's output, which match the following components:
         * '\d+,'                                - index from the test runner
         * '(?:@AssumptionFailure: |@Ignore: )?' - indicate if the case is ignored due to assumption failure or disabled
         * '(.*?)'                               - test method name
         * '(?:\[\d+\])?'                        - execution index, it will appear for the JUnit4's parameterized test
         * '\(([^)]*)\)[^(]*$'                   - class fully qualified name
         */
        const regexp: RegExp = /\d+,(?:@AssumptionFailure: |@Ignore: )?(.*?)(?:\[\d+\])?\(([^)]*)\)[^(]*$/;
        const matchResults: RegExpExecArray | null = regexp.exec(message);
        if (matchResults && matchResults.length === 3) {
            return `${this.projectName}@${matchResults[2]}#${matchResults[1]}`;
        }

        // In case the output is class level, i.e.: `%ERROR 2,a.class.FullyQualifiedName`
        const indexOfSpliter: number = message.lastIndexOf(',');
        if (indexOfSpliter > -1) {
            return `${this.projectName}@${message.slice(indexOfSpliter + 1)}#<TestError>`;
        }

        logger.error(`Failed to parse the message: ${message}`);
        return '';
    }
}

function updateElapsedTime(result: ITestResult): void {
    if (result.duration && result.duration < 0) {
        const end: number = Date.now();
        result.duration += end;
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
