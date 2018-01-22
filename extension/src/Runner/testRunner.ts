// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestSuite } from "../protocols";
import { ITestRunnerContext } from "./testRunnerContext";

export interface ITestRunner {
    setup(tests: TestSuite[], isDebugMode: boolean, context: ITestRunnerContext): Promise<void>;
    run(tests: TestSuite[], isDebugMode: boolean, context: ITestRunnerContext): Promise<void>;
}
