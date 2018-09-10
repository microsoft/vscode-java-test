// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';
import { TestTreeNodeType } from '../Explorer/testTreeNode';

export type Test = {
    tests: TestSuite[];
    dirty: boolean;
};

export type SearchRequest = {
    nodeType: TestTreeNodeType;
    uri: string;
    fullName: string;
};

export type SearchResults = {
    suite: TestSuite;
    displayName: string;
    nodeType: TestTreeNodeType;
};

export type TestSuite = {
    range: Range;
    uri: string;
    test: string;
    parentIndex?: number; // local per file
    parent: TestSuite;
    childrenIndices?: number[]; // local per file
    children: TestSuite[];
    packageName: string;
    level: TestLevel;
    kind: TestKind;
    project: string;
    result?: TestResult;
};

export type TestResult = {
    status?: TestStatus;
    details?: string;
    message?: string;
    duration?: string;
    summary?: string;
};

export enum TestStatus {
    Pass = 'Pass',
    Fail = 'Fail',
    Skipped = 'Skipped',
}

export enum TestLevel {
    Method,
    Class,
}

export enum TestKind {
    JUnit,
    JUnit5,
}
