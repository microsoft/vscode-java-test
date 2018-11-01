// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../../protocols';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit4RunnerResultAnalyzer } from './Junit4RunnerResultAnalyzer';

export class JUnit4Runner extends BaseRunner {
    public constructCommandParams(): string[] {
        return [...super.constructCommandParams(), 'junit', ...this.tests.map((t: ITestItem) => t.fullName)];
    }

    public getTestResultAnalyzer(): BaseRunnerResultAnalyzer {
        return new JUnit4RunnerResultAnalyzer(this.tests);
    }
}
