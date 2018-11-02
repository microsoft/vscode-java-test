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

export interface ISearchChildrenNodeParams {
    level: TestLevel;
    fullName: string;
    uri: string;
}

export interface IProjectInfo {
    path: Uri;
    name: string;
}

export enum TestLevel {
    Folder = 0,
    Package = 1,
    Class = 2,
    NestedClass = 3,
    Method = 4,
}

export enum TestKind {
    JUnit,
    JUnit5,
    TestNG,
}
