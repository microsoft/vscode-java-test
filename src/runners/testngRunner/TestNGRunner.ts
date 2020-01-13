// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { logger } from '../../logger/logger';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { TestNGRunnerResultAnalyzer } from './TestNGRunnerResultAnalyzer';

export class TestNGRunner extends BaseRunner {

    public getRunnerCommandParams(): string[] {
        return ['testng', ...this.testIds.map((id: string) => {
            // parse to fullName
            const index: number = id.indexOf('@');
            if (index < 0) {
                logger.error(`Invalid ID: ${id}`);
                return '';
            }
            return id.slice(index + 1);
        }).filter(Boolean)];
    }

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new TestNGRunnerResultAnalyzer(this.context.projectName);
        }
        return this.runnerResultAnalyzer;
    }
}
