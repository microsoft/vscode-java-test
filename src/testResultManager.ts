// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Uri } from 'vscode';
import { ITestResult, ITestResultDetails } from './runners/models';

class TestResultManager implements Disposable {
    private testResultMap: Map<string, Map<string, ITestResultDetails>> = new Map<string, Map<string, ITestResultDetails>>();

    public storeResult(...results: ITestResult[]): void {
        for (const result of results) {
            const fsPath: string = Uri.parse(result.uri).fsPath;
            if (!this.testResultMap.has(fsPath)) {
                this.testResultMap.set(fsPath, new Map<string, ITestResultDetails>());
            }
            this.testResultMap.get(fsPath)!.set(result.fullName, result.result);
        }
    }

    public getResult(fsPath: string, testFullName: string): ITestResultDetails | undefined {
        const resultsInFsPath: Map<string, ITestResultDetails> | undefined = this.testResultMap.get(fsPath);
        if (resultsInFsPath) {
            return resultsInFsPath.get(testFullName);
        }
        return undefined;
    }

    public hasResultWithFsPath(fsPath: string): boolean {
        return this.testResultMap.has(fsPath);
    }

    public hasResultWithFsPathAndFullName(fsPath: string, testFullName: string): boolean {
        return !!this.getResult(fsPath, testFullName);
    }

    public dispose(): void {
        this.testResultMap.clear();
    }
}

export const testResultManager: TestResultManager = new TestResultManager();
