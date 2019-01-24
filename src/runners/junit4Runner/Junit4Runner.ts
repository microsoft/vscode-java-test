// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../../protocols';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit4RunnerResultAnalyzer } from './JUnit4RunnerResultAnalyzer';

export class JUnit4Runner extends BaseRunner {
    public getRunnerCommandParams(): string[] {
        return ['junit', ...this.tests.map((t: ITestItem) => t.fullName)];
    }

    public getTestResultAnalyzer(): BaseRunnerResultAnalyzer {
        return new JUnit4RunnerResultAnalyzer(this.tests);
    }
}
