// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Uri } from 'vscode';
import { ISearchTestItemParams, ITestItem, TestLevel } from './protocols';
import { searchTestCodeLens, searchTestItems, searchTestItemsAll } from './utils/commandUtils';
import { constructSearchTestItemParams } from './utils/protocolUtils';

class TestItemModel implements Disposable {

    private store: Map<string, ITestItem> = new Map<string, ITestItem>();

    public getItemById(id: string): ITestItem | undefined {
        return this.store.get(id);
    }

    public save(items: ITestItem[]): void {
        for (const item of items) {
            if (item.level < TestLevel.Class) {
                // Only class and method will have the test result.
                continue;
            }

            this.store.set(item.id, Object.assign({}, this.store.get(item.id), item));
        }
    }

    public async getNodeChildren(parent: ITestItem): Promise<ITestItem[]> {
        const searchParams: ISearchTestItemParams = constructSearchTestItemParams(parent.level, parent.fullName, parent.location.uri);
        const responses: ITestItem[] = await searchTestItems(searchParams);
        parent.children = responses.map((child: ITestItem) => child.id);
        this.save([...responses, parent]);
        return responses;
    }

    public async getAllNodes(level: TestLevel, fullName: string, uri: string): Promise<ITestItem[]> {
        const searchParam: ISearchTestItemParams = constructSearchTestItemParams(level, fullName, uri);
        const tests: ITestItem[] = await searchTestItemsAll(searchParam);
        this.save(tests);
        return tests;
    }

    public async getItemsForCodeLens(uri: Uri): Promise<ITestItem[]> {
        const result: ITestItem[] = await searchTestCodeLens(uri.toString());
        this.save(result);
        return result;
    }

    public dispose(): void {
        this.store.clear();
    }
}

export const testItemModel: TestItemModel = new TestItemModel();
