// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem, TestKind, TestLevel } from '../protocols';

export interface ITestResult {
    id: string;
    status?: TestStatus;
    trace?: string;
    message?: string;
    duration?: number;
    summary?: string;
}

export enum TestStatus {
    Pending = 'Pending',
    Running = 'Running',
    Pass = 'Pass',
    Fail = 'Fail',
    Skip = 'Skip',
}

export interface ITestOutputData {
    type: TestOutputType;
    name: string;
}

export enum TestOutputType {
    Info,
    Error,
}

export interface IRunnerContext {
    scope: TestLevel;
    testUri: string;
    fullName: string;
    projectName: string;
    isDebug: boolean;
    kind: TestKind;
    tests: ITestItem[];
    isHierarchicalPackage?: boolean;
}
