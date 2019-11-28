// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable } from 'vscode';
import { ITestResult } from './runners/models';

class TestResultManager implements Disposable {
    private testResultMap: Map<string, ITestResult> = new Map<string, ITestResult>();

    public async storeResult(...results: ITestResult[]): Promise<void> {
        for (const result of results) {
            this.testResultMap.set(result.id, result);
        }
    }

    public getResultById(testId: string): ITestResult | undefined {
        return this.testResultMap.get(testId);
    }

    public removeResultById(testId: string): boolean {
        return this.testResultMap.delete(testId);
    }

    public dispose(): void {
        this.testResultMap.clear();
    }
}

export const testResultManager: TestResultManager = new TestResultManager();