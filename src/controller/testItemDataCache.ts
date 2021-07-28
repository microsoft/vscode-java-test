// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestItem } from 'vscode';
import { TestKind, TestLevel } from '../types';

/**
 * A map cache to save the metadata of the test item.
 * Use a WeakMap here so the key-value will be automatically collected when
 * the actual item is disposed.
 */
class TestItemDataCache {
    private cache: WeakMap<TestItem, ITestItemData> = new WeakMap();

    public set(item: TestItem, data: ITestItemData): void {
        this.cache.set(item, data);
    }

    public get(item: TestItem): ITestItemData | undefined {
        return this.cache.get(item);
    }

    public delete(item: TestItem): boolean {
        return this.cache.delete(item);
    }
}

export const dataCache: TestItemDataCache = new TestItemDataCache();

export interface ITestItemData {
    jdtHandler: string;
    fullName: string;
    projectName: string;
    testLevel: TestLevel;
    testKind: TestKind;
}
