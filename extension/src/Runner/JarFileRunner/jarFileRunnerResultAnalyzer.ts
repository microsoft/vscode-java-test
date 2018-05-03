// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestResult } from '../../Models/protocols';
import { ITestInfo, ITestResult } from '../testModel';

export abstract class JarFileRunnerResultAnalyzer {
    protected _testResults = new Map<string, TestResult>();
    constructor(protected _tests: ITestInfo[]) {
    }
    public abstract analyzeData(data: string): void;
    public abstract feedBack(isCancelled: boolean): ITestResult[];
}
