// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItemBase } from '../protocols';

export interface ITestResult extends ITestItemBase {
    result: ITestResultDetails;
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
    Skipped = 'Skipped',
}
