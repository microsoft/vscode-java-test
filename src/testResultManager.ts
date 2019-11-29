// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Uri } from 'vscode';
import { testExplorer } from './explorer/testExplorer';
import { ITestItem } from './protocols';
import { ITestResult } from './runners/models';
import { testItemModel } from './testItemModel';

class TestResultManager implements Disposable {
    private testResultMap: Map<string, ITestResult> = new Map<string, ITestResult>();

    public async storeResult(...results: ITestResult[]): Promise<void> {
        for (const result of results) {
            this.testResultMap.set(result.id, result);
            this.notifyExplorer(result);
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

    private notifyExplorer(result: ITestResult): void {
        const item: ITestItem | undefined = testItemModel.getItemById(result.id);
        if (item) {
            const node: ITestItem | undefined = testExplorer.getNodeByFsPath(Uri.parse(item.location.uri).fsPath);
            if (node) {
                testExplorer.refresh(node);
            }
        }
    }
}

export const testResultManager: TestResultManager = new TestResultManager();
