// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { testResultManager } from '../../testResultManager';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestOutputData, ITestResult, TestStatus } from '../models';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class TestNGRunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

    protected processData(data: string): void {
        super.processData(data);
        const outputData: ITestNGOutputData = JSON.parse(data) as ITestNGOutputData;
        const id: string = `${this.projectName}@${outputData.attributes.name}`;
        switch (outputData.name) {
            case TEST_START:
                testResultManager.storeResult({
                    id,
                    status: TestStatus.Running,
                });
                this.testIds.add(id);
                break;
            case TEST_FAIL:
                const failedResult: ITestResult | undefined = testResultManager.getResultById(id);
                if (!failedResult) {
                    return;
                }
                failedResult.status = TestStatus.Fail;
                failedResult.message = outputData.attributes.message;
                failedResult.trace = outputData.attributes.trace;
                testResultManager.storeResult(failedResult);
                break;
            case TEST_FINISH:
                const finishedResult: ITestResult | undefined = testResultManager.getResultById(id);
                if (!finishedResult) {
                    return;
                }
                if (finishedResult.status === TestStatus.Running) {
                    finishedResult.status = TestStatus.Pass;
                }
                finishedResult.duration = Number.parseInt(outputData.attributes.duration, 10);
                testResultManager.storeResult(finishedResult);
                break;
        }
    }
}

interface ITestNGOutputData extends ITestOutputData {
    attributes: ITestNGAttributes;
}

interface ITestNGAttributes  {
    name: string;
    duration: string;
    location: string;
    message: string;
    trace: string;
}
