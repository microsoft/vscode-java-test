// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResultDetails, TestStatus } from '../models';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class JUnit4RunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

    protected processData(data: string): void {
        const outputData: IJUnit4TestOutputData = JSON.parse(data) as IJUnit4TestOutputData;
        switch (outputData.name) {
            case TEST_START:
                this.testResults.set(outputData.attributes.name, {
                    status: undefined,
                });
                break;
            case TEST_FAIL:
                const failedResult: ITestResultDetails | undefined = this.testResults.get(outputData.attributes.name);
                if (!failedResult) {
                    return;
                }
                failedResult.status = TestStatus.Fail;
                failedResult.message = outputData.attributes.message;
                failedResult.trace = outputData.attributes.trace;
                break;
            case TEST_FINISH:
                const finishedResult: ITestResultDetails | undefined = this.testResults.get(outputData.attributes.name);
                if (!finishedResult) {
                    return;
                }
                if (!finishedResult.status) {
                    finishedResult.status = TestStatus.Pass;
                }
                finishedResult.duration = outputData.attributes.duration;
                break;
        }
    }
}

interface IJUnit4TestOutputData {
    type: JUnit4TestOutputType;
    name: string;
    attributes: IJUnitTestAttributes;
}

interface IJUnitTestAttributes  {
    name: string;
    duration: string;
    location: string;
    message: string;
    trace: string;
}

enum JUnit4TestOutputType {
    Info,
    Error,
}
