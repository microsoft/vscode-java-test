// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { logger } from '../../logger/logger';
import { ITestItem, TestLevel } from '../../protocols';
import { ITestResult, ITestResultDetails, TestStatus } from '../models';

export abstract class BaseRunnerResultAnalyzer {
    protected testResults: Map<string, ITestResultDetails> = new Map<string, ITestResultDetails>();
    private readonly regex: RegExp = /@@<TestRunner-({[\s\S]*?})-TestRunner>/;

    constructor(protected tests: ITestItem[]) {
    }

    public analyzeData(data: string): void {
        const lines: string[] = data.split(/\r?\n/);
        for (const line of lines) {
            if (!line) {
                continue;
            }
            const match: RegExpExecArray | null = this.regex.exec(line);
            if (match) {
                // Message from Test Runner executable
                try {
                    this.processData(match[1]);
                    logger.verbose(this.unescape(line));
                } catch (error) {
                    logger.error(`Failed to parse output data: ${data}`, error);
                }
            } else {
                // Message from the test case itself
                logger.info(line);
            }
        }
    }

    public analyzeError(error: string): void {
        logger.error(this.unescape(error));
    }

    public feedBack(): ITestResult[] {
        const result: ITestResult[] = [];
        for (const test of this.tests) {
            this.processTestItemRecursively(test, result);
        }
        return result;
    }

    protected processTestItemRecursively(testItem: ITestItem, resultList: ITestResult[]): void {
        if (testItem.level === TestLevel.Method) {
            resultList.push(this.processMethod(testItem));
        } else {
            testItem.children.forEach((child: ITestItem) => this.processTestItemRecursively(child, resultList));
        }
    }

    protected abstract processData(data: string): void;

    protected processMethod(test: ITestItem): ITestResult {
        let testResultDetails: ITestResultDetails | undefined = this.testResults.get(test.fullName);
        if (!testResultDetails) {
            testResultDetails = { status: TestStatus.Skip };
        }

        return {
            displayName: test.displayName,
            fullName: test.fullName,
            uri: Uri.parse(test.uri).toString(),
            range: test.range,
            result: testResultDetails,
        };
    }

    protected unescape(content: string): string {
        return content.replace(/\\r/gm, '\r')
            .replace(/\\f/gm, '\f')
            .replace(/\\n/gm, '\n')
            .replace(/\\t/gm, '\t')
            .replace(/\\b/gm, '\b');
    }

    protected get outputRegex(): RegExp {
        return this.regex;
    }
}
