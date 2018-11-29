// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { ITestItem } from '../../protocols';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResult, ITestResultDetails, TestStatus } from '../models';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class TestNGRunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

    protected processData(data: string): void {
        const outputData: ITestNGOutputData = JSON.parse(data) as ITestNGOutputData;
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
                failedResult.message = this.decodeContent(outputData.attributes.message);
                failedResult.details = this.decodeContent(outputData.attributes.details);
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

    protected processMethod(test: ITestItem): ITestResult {
        let testResultDetails: ITestResultDetails | undefined = this.testResults.get(test.fullName);
        if (!testResultDetails) {
            testResultDetails = { status: TestStatus.Skip };
        }

        return {
            fullName: test.fullName,
            uri: Uri.parse(test.uri).toString(),
            result: testResultDetails,
        };
    }
}

interface ITestNGOutputData {
    type: TestNGOutputType;
    name: string;
    attributes: ITestNGAttributes;
}

interface ITestNGAttributes  {
    name: string;
    duration: string;
    location: string;
    message: string;
    details: string;
}

enum TestNGOutputType {
    Info,
    Error,
}
