// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ILocation } from '../protocols';

export interface ITestResult {
    details: ITestResultDetails;
    location: ILocation | undefined;
    displayName: string;
    fullName: string;
}

export interface ITestResultDetails {
    status?: TestStatus;
    trace?: string;
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
    location: undefined,
    details: { status: TestStatus.Skip },
};
