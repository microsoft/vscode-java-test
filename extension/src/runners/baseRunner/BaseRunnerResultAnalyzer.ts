// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { ITestItem, TestLevel } from '../../protocols';
import { testOutputChannel } from '../../testOutputChannel';
import { ITestResult, ITestResultDetails, TestStatus } from '../models';

export abstract class BaseRunnerResultAnalyzer {
    protected testResults: Map<string, ITestResultDetails> = new Map<string, ITestResultDetails>();
    private readonly regex: RegExp = /@@<TestRunner-({[\s\S]*?})-TestRunner>/gm;

    constructor(protected tests: ITestItem[]) {
    }

    public analyzeData(data: string): void {
        testOutputChannel.info(data);
        let match: RegExpExecArray | null;
        do {
            match = this.regex.exec(data);
            if (match) {
                try {
                    this.processData(match[1]);
                } catch (error) {
                    testOutputChannel.error(`Failed to parse output data: ${data}`, error);
                }
            }
        } while (match);
    }

    public analyzeError(error: string): void {
        testOutputChannel.error(error);
    }

    public feedBack(isCanceled: boolean): ITestResult[] {
        const result: ITestResult[] = [];
        for (const test of this.tests) {
            if (isCanceled) {
                return result;
            }
            if (test.level === TestLevel.Class) {
                test.children.forEach((method: ITestItem) => result.push(this.processMethod(method)));
            } else {
                result.push(this.processMethod(test));
            }
        }
        return result;
    }

    protected abstract processData(data: string): void;

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

    protected decodeContent(content: string): string {
        if (!content) {
            return content;
        }
        return content.replace(new RegExp('&#x40;', 'gm'), '@');
    }

    protected get outputRegex(): RegExp {
        return this.regex;
    }
}
