// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResultDetails, TestStatus } from '../models';

const TEST_START: string = 'testStarted';
const TEST_IGNORED: string = 'testIgnored';
const TEST_FINISH: string = 'testFinished';

export class JUnit5RunnerResultAnalyzer extends BaseRunnerResultAnalyzer {

    protected processData(data: string): void {
        const outputData: IJUnit5TestOutputData = JSON.parse(data) as IJUnit5TestOutputData;
        if (outputData.attributes.type !== JUnit5TestType.Test) {
            return;
        }
        const res: ITestResultDetails | undefined = this.testResults.get(this.parseFullyQualifiedNameFromId(outputData.attributes.id));
        switch (outputData.name) {
            case TEST_START:
                if (!res) {
                    this.testResults.set(this.parseFullyQualifiedNameFromId(outputData.attributes.id), {
                        status: undefined,
                    });
                }
                break;
            case TEST_IGNORED:
                this.testResults.set(this.parseFullyQualifiedNameFromId(outputData.attributes.id),
                {
                    status: TestStatus.Skip,
                    trace: outputData.attributes.trace,
                });
                break;
            case TEST_FINISH:
                // Do not update result if already has a failed result for current test - For @ParameterizedTest
                if (!res || res.status === TestStatus.Fail) {
                    return;
                }
                res.status = this.parseTestStatus(outputData.attributes.status);
                res.trace = outputData.attributes.trace;
                res.duration = outputData.attributes.duration;
                break;
        }
    }

    private parseFullyQualifiedNameFromId(id: string): string {
        if (!id) {
            return id;
        }
        let res: string = '';
        const regex: RegExp = /\[(.*?):(.*?)\]/g;
        while (true) {
            const execResult: RegExpExecArray | null = regex.exec(id);
            if (!execResult || execResult.length < 3) {
                break;
            }
            switch (execResult[1]) {
                case 'class':
                    res += execResult[2];
                    break;
                case 'nested-class':
                    res += `$${execResult[2]}`;
                    break;
                case 'method':
                case 'test-template':
                case 'test-factory':
                    let methodName: string = execResult[2];
                    const index: number = methodName.indexOf('(');
                    if (index >= 0) {
                        methodName = methodName.substring(0, index);
                    }
                    res += `#${methodName}`;
                    break;
            }
        }
        return res;
    }

    private parseTestStatus(status: JUnit5TestStatus): TestStatus {
        switch (status) {
            case JUnit5TestStatus.Failed:
                return TestStatus.Fail;
            case JUnit5TestStatus.Successful:
                return TestStatus.Pass;
            case JUnit5TestStatus.Aborted:
                return TestStatus.Skip;
        }
    }
}

interface IJUnit5TestOutputData {
    name: string;
    attributes: IJUnit5TestAttributes;
}

interface IJUnit5TestAttributes  {
    name: string;
    id: string;
    type: JUnit5TestType;
    duration: string;
    status: JUnit5TestStatus;
    message: string;
    trace: string;
}

enum JUnit5TestType {
    Test = 'TEST',
    Container = 'CONTAINER',
}

enum JUnit5TestStatus {
    Failed = 'FAILED',
    Successful = 'SUCCESSFUL',
    Aborted = 'ABORTED',
}
