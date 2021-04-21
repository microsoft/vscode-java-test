// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';

export interface ILocation {
    uri: string;
    range: Range;
}

export interface ITestItem {
    id: string;
    displayName: string;
    fullName: string;
    children: string[] | undefined;
    kind: TestKind;
    project: string;
    level: TestLevel;
    location: ILocation;
}

export interface ISearchTestItemParams {
    level: TestLevel;
    fullName: string;
    uri: string;
    isHierarchicalPackage?: boolean;
}

export enum TestLevel {
    Root = 0,
    Folder = 1,
    Package = 2,
    Class = 3,
    Method = 4,
}

export enum TestKind {
    JUnit5 = 0,
    JUnit = 1,
    TestNG = 2,
    None = 100,
}
