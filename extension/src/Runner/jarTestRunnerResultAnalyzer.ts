// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestResult } from "../protocols";
import { ITestInfo, ITestResult } from "./testModel";

export abstract class JarTestRunnerResultAnalyzer {
    private _testResults = new Map<string, TestResult>();
    constructor(private _tests: ITestInfo[]) {
    }
    public abstract analyzeData(data: string): void;
    public abstract feedBack(): ITestResult[];
}
