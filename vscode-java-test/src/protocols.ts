import { Range } from 'vscode';

export type Test = {
    tests: TestSuite[];
    dirty: boolean;
}

export type TestSuite = {
    range: Range;
    uri: string;
    test: string;
    parentIndex: number; // local per file
    parent: TestSuite;
    childrenIndices: number[]; // local per file
    children: TestSuite[];
    packageName: string;
    level: TestLevel;
    status?: TestStatus;
    details: string;
}

export enum TestStatus {
    Pass,
    Fail,
    Skipped,
}

export enum TestLevel {
    Method,
    Class,
}