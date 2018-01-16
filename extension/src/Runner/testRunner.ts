// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestRunnerContext } from "./testRunnerContext";

export interface ITestRunner {
    run(context: ITestRunnerContext): undefined | Promise<undefined>;
}
