// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { testResultManager } from '../../testResultManager';
import { ITestOutputData, ITestResult, TestStatus } from '../models';

export abstract class BaseRunnerResultAnalyzer {
    protected testIds: Set<string> = new Set<string>();
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

    public tearDown(): Set<string> {
        for (const id of this.testIds) {
            const result: ITestResult | undefined = testResultManager.getResultById(id);
            // In case that unexpected errors terminate the execution
            if (result && result.status === TestStatus.Running) {
                result.status = undefined;
                testResultManager.storeResult(result);
            }
        }
        return this.testIds;
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
