// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestInfo } from "./testModel";

export interface ITestRunnerParameters {
    tests: ITestInfo[];
    isDebugMode: boolean;
    storagePath: string;
    port: number | undefined;
}
