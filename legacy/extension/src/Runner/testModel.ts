// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';
import { TestLevel, TestResult } from '../Models/protocols';

export interface ITestInfo {
    range: Range;
    uri: string;
    test: string;
    parent: ITestInfo;
    children: ITestInfo[];
    packageName: string;
    level: TestLevel;
}

export interface ITestResult {
    uri: string;
    test: string;
    result: TestResult;
}
