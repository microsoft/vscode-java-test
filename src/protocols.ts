// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';

export interface ILocation {
    uri: string;
    range: Range;
}

export interface ITestItem extends ILocation {
    displayName: string;
    fullName: string;
    children: ITestItem[] | undefined;
    kind: TestKind;
    project: string;
    level: TestLevel;
    paramTypes: string[];
}

export interface ISearchTestItemParams {
    level: TestLevel;
    fullName: string;
    uri: string;
}

export interface IProjectInfo {
    path: string;
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
