// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResultDetails, TestStatus } from '../models';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class JUnit4RunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

    protected processData(data: string): void {
        let res: ITestResultDetails | undefined;
        const outputData: IJUnit4TestOutputData = JSON.parse(data) as IJUnit4TestOutputData;
        switch (outputData.name) {
            case TEST_START:
                this.testResults.set(outputData.attributes.name, {
                    status: undefined,
                });
                break;
            case TEST_FAIL:
                res = this.testResults.get(outputData.attributes.name);
                if (!res) {
                    return;
                }
                res.status = TestStatus.Fail;
                res.message = this.decodeContent(outputData.attributes.message);
                res.details = this.decodeContent(outputData.attributes.details);
                break;
            case TEST_FINISH:
                res = this.testResults.get(outputData.attributes.name);
                if (!res) {
                    return;
                }
                if (!res.status) {
                    res.status = TestStatus.Pass;
                }
                res.duration = outputData.attributes.duration;
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
    details: string;
}

enum JUnit4TestOutputType {
    Info,
    Error,
}
