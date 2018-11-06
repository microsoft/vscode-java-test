// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { RunConfigItem } from '../Models/testConfig';
import { ITestInfo, ITestResult } from './testModel';
import { ITestRunnerParameters } from './testRunnerParameters';

export interface ITestRunner {
    setup(tests: ITestInfo[], isDebugMode: boolean, config: RunConfigItem): Promise<ITestRunnerParameters>;
    run(params: ITestRunnerParameters): Promise<ITestResult[]>;
    postRun(): Promise<void>;
    cancel(): Promise<void>;
    clone(): ITestRunner;
}
