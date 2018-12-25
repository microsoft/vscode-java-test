// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel } from '../../protocols';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit5RunnerResultAnalyzer } from './JUnit5RunnerResultAnalyzer';

export class JUnit5Runner extends BaseRunner {
    public constructCommandParams(): string[] {
        return [...super.constructCommandParams(), 'junit5', ...this.constructParamsForTests()];
    }

    public getTestResultAnalyzer(): BaseRunnerResultAnalyzer {
        return new JUnit5RunnerResultAnalyzer(this.tests);
    }

    private constructParamsForTests(): string[] {
        const params: string[] = [];
        for (const test of this.tests) {
            if (test.level === TestLevel.Class || test.level === TestLevel.NestedClass) {
                params.push('-c', test.fullName);
            } else if (test.level === TestLevel.Method) {
                params.push('-m', `${test.fullName}(${test.paramTypes.join(',')})`);
            }
        }
        return params;
    }
}
