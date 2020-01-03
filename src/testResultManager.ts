// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable } from 'vscode';
import { testExplorer } from './explorer/testExplorer';
import { ITestItem, TestLevel } from './protocols';
import { ITestResult } from './runners/models';
import { testItemModel } from './testItemModel';

class TestResultManager implements Disposable {
    private testResultMap: Map<string, ITestResult> = new Map<string, ITestResult>();

    public async storeResult(...results: ITestResult[]): Promise<void> {
        for (const result of results) {
            this.testResultMap.set(result.id, result);
            this.notifyExplorer(result.id);
        }
    }

    public getResultById(testId: string): ITestResult | undefined {
        return this.testResultMap.get(testId);
    }

    public getResultsByIds(testIds: string[]): ITestResult[] {
        const results: ITestResult[] = [];
        for (const id of testIds) {
            const storedResult: ITestResult | undefined = this.testResultMap.get(id);
            if (storedResult) {
                results.push(storedResult);
            }
        }
        return results;
    }

    public removeResultById(testId: string): void {
        if (this.testResultMap.delete(testId)) {
            this.notifyExplorer(testId);
        }
    }

    public dispose(): void {
        this.testResultMap.clear();
    }

    private notifyExplorer(id: string): void {
        const item: ITestItem | undefined = testItemModel.getItemById(id);
        if (item && item.level === TestLevel.Method) {
            testExplorer.refresh(item);
        }
    }
}

export const testResultManager: TestResultManager = new TestResultManager();
