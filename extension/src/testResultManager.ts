// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Uri } from 'vscode';
import { ITestResult, ITestResultDetails } from './runners/models';

class TestResultManager implements Disposable {
    private testResultMap: Map<string, IResultsInFsPath> = new Map<string, IResultsInFsPath>();

    public storeResult(...results: ITestResult[]): void {
        for (const result of results) {
            const fsPath: string = Uri.parse(result.uri).fsPath;
            if (!this.testResultMap.has(fsPath)) {
                this.testResultMap.set(fsPath, {
                    methodsMap: new Map<string, ITestResultDetails>(),
                    isDirty: false,
                });
            }
            this.testResultMap.get(fsPath)!.methodsMap.set(result.fullName, result.result);
        }
    }

    public getResult(fsPath: string, testFullName: string): ITestResultDetails | undefined {
        const resultsInFsPath: IResultsInFsPath | undefined = this.testResultMap.get(fsPath);
        if (resultsInFsPath) {
            return resultsInFsPath.methodsMap.get(testFullName);
        }
        return undefined;
    }

    public hasResultWithUri(uriString: string): boolean {
        return this.testResultMap.has(uriString);
    }

    public dispose(): void {
        this.testResultMap.clear();
    }
}

interface IResultsInFsPath {
    methodsMap: Map<string, ITestResultDetails>;
    isDirty: boolean;
}

export const testResultManager: TestResultManager = new TestResultManager();
