// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestSuite } from "../protocols";

export interface ITestRunnerContext {
    tests: TestSuite[];
    isDebugMode: boolean;
    contextData: Map<string, ContextData>;
}

export class TestRunnerContext implements ITestRunnerContext {

    public readonly contextData: Map<string, ContextData>;
    constructor(readonly tests: TestSuite[], readonly isDebugMode: boolean) {
        this.contextData = new Map<string, ContextData>();
    }
}

export type ContextData = object | string | number | boolean;
