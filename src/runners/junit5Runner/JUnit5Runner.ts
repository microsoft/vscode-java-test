// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel } from '../../protocols';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit5RunnerResultAnalyzer } from './JUnit5RunnerResultAnalyzer';

export class JUnit5Runner extends BaseRunner {
    public getRunnerCommandParams(): string[] {
        const params: string[] = ['junit5'];
        if (!this.hasClassNameParam()) {
            // Set --include-classname to '.*' to treat all class name as valid test class.
            // See: https://github.com/microsoft/vscode-java-test/issues/381.
            params.push('--include-classname', '".*"');
        }

        params.push(...this.constructParamsForTests());

        return params;
    }

    public getTestResultAnalyzer(): BaseRunnerResultAnalyzer {
        return new JUnit5RunnerResultAnalyzer(this.tests);
    }

    private hasClassNameParam(): boolean {
        if (!this.config || !this.config.args) {
            return false;
        }

        return this.config.args.some((element: string) => {
            return element === '-n' || element === '--include-classname';
        });
    }

    private constructParamsForTests(): string[] {
        const params: string[] = [];
        for (const test of this.tests) {
            if (test.level === TestLevel.Class) {
                params.push('-c', test.fullName);
            } else if (test.level === TestLevel.Method) {
                params.push('-m', `${test.fullName}(${test.paramTypes.join(',')})`);
            }
        }
        return params;
    }
}
