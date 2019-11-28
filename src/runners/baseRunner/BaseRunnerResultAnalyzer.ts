// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { ITestOutputData, ITestResult } from '../models';

export abstract class BaseRunnerResultAnalyzer {
    protected testResults: Map<string, ITestResult> = new Map<string, ITestResult>();
    private readonly regex: RegExp = /@@<TestRunner-({[\s\S]*?})-TestRunner>/;

    constructor(protected projectName: string) {
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
                } catch (error) {
                    logger.error(`Failed to parse output data: ${data}`, error);
                }
            } else {
                // Message from the test case itself
                logger.info(line);
            }
        }
    }

    public feedBack(): ITestResult[] {
        return Array.from(this.testResults.values());
    }

    protected processData(data: string): void {
        const outputData: ITestOutputData = JSON.parse(data) as ITestOutputData;
        if (outputData.name.toLocaleLowerCase() === 'error') {
            logger.error(this.unescape(data));
        } else {
            // Append '\n' becuase the original line separator has been splitted
            logger.verbose(this.unescape(data) + '\n');
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
