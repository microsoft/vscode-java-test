import { Range } from 'vscode';

export type Test = {
    tests: TestSuite[];
    dirty: boolean;
}

export type TestSuite = {
    range: Range;
    uri: string;
    test: string;
    parent: TestSuite;
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