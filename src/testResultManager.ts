// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Uri, workspace, TextDocumentChangeEvent } from 'vscode';
import { ITestResult, ITestResultDetails } from './runners/models';

class TestResultManager implements Disposable {
    private testResultMap: Map<string, Map<string, ITestResultDetails>> = new Map<string, Map<string, ITestResultDetails>>();

    constructor() {
        workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
            const fsPath: string = e.document.fileName;
            if (this.testResultMap.has(fsPath)) {
                this.testResultMap.set(fsPath, new Map<string, ITestResultDetails>());
            }            
        });        
    }

    public storeResult(...results: ITestResult[]): void {
        for (const result of results) {
            const fsPath: string = Uri.parse(result.uri).fsPath;
            if (!this.testResultMap.has(fsPath)) {
                this.testResultMap.set(fsPath, new Map<string, ITestResultDetails>());
            }
            this.testResultMap.get(fsPath)!.set(result.fullName, result.result);
        }
    }

    public getResultDetails(fsPath: string, testFullName: string): ITestResultDetails | undefined {
        const resultsInFsPath: Map<string, ITestResultDetails> | undefined = this.getResults(fsPath);
        if (resultsInFsPath) {
            return resultsInFsPath.get(testFullName);
        }
        return undefined;
    }

    public getResults(fsPath: string): Map<string, ITestResultDetails> | undefined {
        return this.testResultMap.get(fsPath);
    }

    public dispose(): void {
        this.testResultMap.clear();
    }
}

export const testResultManager: TestResultManager = new TestResultManager();
