// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { ITestItem, TestLevel } from '../../protocols';
import { defaultResult, ITestResult, ITestResultDetails } from '../models';

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
        const itemMap: Map<string, ITestItem> = new Map<string, ITestItem>();
        for (const test of this.tests) {
            this.flatTestItems(test, itemMap);
        }
        this.parseResults(result, itemMap);
        return result;
    }

    protected abstract processData(data: string): void;

    protected flatTestItems(item: ITestItem, map: Map<string, ITestItem>): void {
        if (item.level === TestLevel.Method) {
            map.set(item.fullName, item);
        } else if (item.children) {
            item.children.forEach((child: ITestItem) => this.flatTestItems(child, map));
        }
    }

    protected parseResults(resultArray: ITestResult[], itemMap: Map<string, ITestItem>): void {
        for (const [key, value] of this.testResults.entries()) {
            let result: ITestResult = Object.assign({}, defaultResult, {
                fullName: key,
                details: value,
            });

            const item: ITestItem | undefined = itemMap.get(key);
            if (item) {
                result =  {
                    displayName: item.displayName,
                    location: item.location,
                    fullName: key,
                    details: value,
                };
            } else {
                result = Object.assign(result, {
                    displayName: key.slice(key.indexOf('#') + 1),
                });
            }

            resultArray.push(result);
            itemMap.delete(key);
        }
    }

    protected unescape(content: string): string {
        return content.replace(/\\r/gm, '\r')
            .replace(/\\f/gm, '\f')
            .replace(/\\n/gm, '\n')
            .replace(/\\t/gm, '\t')
            .replace(/\\b/gm, '\b')
            .replace(/\\"/gm, '"');
    }
}
