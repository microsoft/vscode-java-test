// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range, TestItem, TestRun, WorkspaceFolder } from 'vscode';

export interface IJavaTestItem {
    children: IJavaTestItem[];
    uri: string | undefined;
    range: Range | undefined;
    jdtHandler: string;
    fullName: string;
    label: string;
    id: string;
    projectName: string;
    testKind: TestKind;
    testLevel: TestLevel;
    /**
     * Optional fields for projects
     */
    natureIds?: string[];
}

export enum TestKind {
    JUnit5 = 0,
    JUnit = 1,
    TestNG = 2,
    None = 100,
}

export enum TestLevel {
    Root = 0,
    Workspace = 1,
    WorkspaceFolder = 2,
    Project = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Invocation = 7,
}

export interface IRunTestContext {
    isDebug: boolean;
    kind: TestKind;
    projectName: string;
    testItems: TestItem[];
    testRun: TestRun;
    workspaceFolder: WorkspaceFolder;
}

export enum ProjectType {
    Gradle,
    Maven,
    UnmanagedFolder,
    Other,
}
