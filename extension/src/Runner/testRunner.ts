// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestSuite } from "../protocols";
import { RunnerResultStream } from "./runnerResultStream";
import { ITestRunnerEnvironment } from "./testRunnerEnvironment";

export interface ITestRunner {
    setup(tests: TestSuite[], isDebugMode: boolean): Promise<ITestRunnerEnvironment>;
    run(env: ITestRunnerEnvironment): Promise<RunnerResultStream>;
    updateTestStatus(env: ITestRunnerEnvironment, result: RunnerResultStream): Promise<void>;
}
