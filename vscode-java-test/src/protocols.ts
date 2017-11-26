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
    result?: TestResult;
}

export type TestResult = {
    status?: TestStatus;
    details: string;
    message: string;
    duration?: string;
    summary: string;
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