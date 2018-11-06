// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range, Uri } from 'vscode';

export interface ITestItemBase {
    fullName: string;
    uri: string;
}

export interface ITestItem extends ITestItemBase {
    displayName: string;
    range: Range;
    children: ITestItem[];
    parent: ITestItem;
    kind: TestKind;
    project: string;
    level: TestLevel;
}

export interface ISearchTestItemParams {
    level: TestLevel;
    fullName: string;
    uri: string;
}

export interface IProjectInfo {
    path: Uri;
    name: string;
}

export enum TestLevel {
    Root = 0,
    Folder = 1,
    Package = 2,
    Class = 3,
    NestedClass = 4,
    Method = 5,
}

export enum TestKind {
    JUnit,
    JUnit5,
    TestNG,
}
