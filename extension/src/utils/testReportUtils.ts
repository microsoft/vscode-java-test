// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { ITestItem, ITestItemBase } from '../protocols';
import { testReportProvider } from '../testReportProvider';

export function encodeTestReportUri(tests: ITestItemBase[], type: TestReportType = TestReportType.All): Uri {
    const queryString: string = JSON.stringify([tests.map((test: ITestItem) => Uri.parse(test.uri).toString()), tests.map((test: ITestItem) => test.fullName), type]);
    return Uri.parse(`${testReportProvider.scheme}:${testReportProvider.testReportName}?${encodeURIComponent(queryString)}`);
}

export function decodeTestReportUri(uri: Uri): [string[], string[], TestReportType] {
    return JSON.parse(decodeURIComponent(uri.query)) as [string[], string[], TestReportType];
}

export enum TestReportType {
    All,
    Passed,
    Failed,
}
