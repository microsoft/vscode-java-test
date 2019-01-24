// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../../protocols';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { TestNGRunnerResultAnalyzer } from './TestNGRunnerResultAnalyzer';

export class TestNGRunner extends BaseRunner {

    public getRunnerCommandParams(): string[] {
        return ['testng', ...this.tests.map((t: ITestItem) => t.fullName)];
    }

    public getTestResultAnalyzer(): BaseRunnerResultAnalyzer {
        return new TestNGRunnerResultAnalyzer(this.tests);
    }
}
