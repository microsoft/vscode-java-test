// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';

export interface ITestResult {
    details: ITestResultDetails;
    uri: string | undefined;
    range: Range | undefined;
    displayName: string;
    fullName: string;
}

export interface ITestResultDetails {
    status?: TestStatus;
    details?: string;
    message?: string;
    duration?: string;
    summary?: string;
}

export enum TestStatus {
    Pass = 'Pass',
    Fail = 'Fail',
    Skip = 'Skip',
}

export const defaultResult: ITestResult = {
    displayName: '',
    fullName: '',
    uri: undefined,
    range: undefined,
    details: { status: TestStatus.Skip },
};
