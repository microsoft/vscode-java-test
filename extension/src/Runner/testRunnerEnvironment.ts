// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestSuite } from "../protocols";

export interface ITestRunnerEnvironment {
    tests: TestSuite[];
    isDebugMode: boolean;
    storagePath: string;
    port: number | undefined;
    transactionId: string | undefined; // TODO: remove later after refactoring logger
}

export class JarFileTestRunnerEnvironment implements ITestRunnerEnvironment {
    public tests: TestSuite[];

    public isDebugMode: boolean;

    public storagePath: string;

    public port: number | undefined;

    public transactionId: string | undefined;

    public classpathStr: string;
}
