// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { TestNGRunnerResultAnalyzer } from './TestNGRunnerResultAnalyzer';

export class TestNGRunner extends BaseRunner {

    public getRunnerCommandParams(): string[] {
        return ['testng', ...this.testIds.map((id: string) => {
            // parse to fullName
            const index: number = id.indexOf('@') + 1;
            if (index > -1) {
                return id.slice(index);
            }
            return '';
        }).filter(Boolean)];
    }

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new TestNGRunnerResultAnalyzer(this.context.projectName);
        }
        return this.runnerResultAnalyzer;
    }
}
