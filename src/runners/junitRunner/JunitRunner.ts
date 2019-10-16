// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnitRunnerResultAnalyzer } from './JUnitRunnerResultAnalyzer';

export class JUnitRunner extends BaseRunner {

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new JUnitRunnerResultAnalyzer(this.tests);
        }
        return this.runnerResultAnalyzer;
    }
}
