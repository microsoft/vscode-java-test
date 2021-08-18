// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestItem } from 'vscode';
import { dataCache } from '../../controller/testItemDataCache';
import { TestLevel } from '../../types';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { RunnerResultAnalyzer } from '../baseRunner/RunnerResultAnalyzer';
import { TestNGRunnerResultAnalyzer } from './TestNGRunnerResultAnalyzer';

export class TestNGRunner extends BaseRunner {

    public getRunnerCommandParams(): string[] {
        const testMethods: TestItem[] = [];
        const queue: TestItem[] = [...this.testContext.testItems];
        while (queue.length) {
            const item: TestItem = queue.shift()!;
            const testLevel: TestLevel | undefined = dataCache.get(item)?.testLevel;
            if (testLevel === undefined) {
                continue;
            }
            if (testLevel === TestLevel.Method) {
                testMethods.push(item);
            } else {
                item.children.forEach((child: TestItem) => {
                    queue.push(child);
                });
            }
        }

        return ['testng', ...testMethods.map((method: TestItem) => {
            // parse to fullName
            const index: number = method.id.indexOf('@');
            if (index < 0) {
                return '';
            }
            return method.id.slice(index + 1);
        }).filter(Boolean)];
    }

    protected getAnalyzer(): RunnerResultAnalyzer {
        return new TestNGRunnerResultAnalyzer(this.testContext);
    }
}
