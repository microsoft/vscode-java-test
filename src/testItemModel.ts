// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, Disposable, Uri } from 'vscode';
import { ISearchTestItemParams, ITestItem, TestLevel } from './protocols';
import { searchTestCodeLens, searchTestItems, searchTestItemsAll } from './utils/commandUtils';
import { constructSearchTestItemParams } from './utils/protocolUtils';

class TestItemModel implements Disposable {

    private store: Map<string, ITestItem> = new Map<string, ITestItem>();
    private idMappedByFsPath: Map<string, Set<string>> = new Map<string, Set<string>>();

    public getItemById(id: string): ITestItem | undefined {
        return this.store.get(id);
    }

    public async getNodeChildren(parent: ITestItem): Promise<ITestItem[]> {
        const searchParams: ISearchTestItemParams = constructSearchTestItemParams(parent.level, parent.fullName, parent.location.uri);
        const childrenNodes: ITestItem[] = await searchTestItems(searchParams);
        parent.children = childrenNodes.map((child: ITestItem) => child.id);
        this.save([parent]);
        return this.save(childrenNodes);
    }

    public async getAllNodes(level: TestLevel, fullName: string, uri: string, token: CancellationToken): Promise<ITestItem[]> {
        const searchParam: ISearchTestItemParams = constructSearchTestItemParams(level, fullName, uri);
        const tests: ITestItem[] = await searchTestItemsAll(searchParam, token);
        if (token.isCancellationRequested) {
            return [];
        }
        return this.save(tests);
    }

    public async getItemsForCodeLens(uri: Uri, token?: CancellationToken): Promise<ITestItem[]> {
        const result: ITestItem[] = await searchTestCodeLens(uri.toString(), token);
        return this.save(result);
    }

    public getItemsByFsPath(fsPath: string): ITestItem[] {
        const res: ITestItem[] = [];
        const idSet: Set<string> | undefined = this.idMappedByFsPath.get(fsPath);
        if (idSet) {
            for (const id of idSet) {
                const item: ITestItem | undefined = this.store.get(id);
                if (!item) {
                    continue;
                }
                res.push(item);
            }
        }
        return res;
    }

    public removeTestItemById(id: string): boolean {
        return this.store.delete(id);
    }

    public removeIdMappingByFsPath(fsPath: string): boolean {
        return this.idMappedByFsPath.delete(fsPath);
    }

    public dispose(): void {
        this.store.clear();
        this.idMappedByFsPath.clear();
    }

    private save(items: ITestItem[]): ITestItem[] {
        const storedItems: ITestItem[] = [];
        for (const item of items) {
            if (item.level < TestLevel.Class) {
                // Only save class and method since they have the test results,
                // still push the items into the returned array to let explorer show them.
                storedItems.push(item);
                continue;
            }

            let storedItem: ITestItem | undefined = this.store.get(item.id);
            if (storedItem) {
                storedItem = Object.assign(storedItem, item);
            } else {
                storedItem = Object.assign({}, item);
            }
            this.store.set(item.id, storedItem);
            this.updateIdMapping(item);
            storedItems.push(storedItem);
        }

        return storedItems;
    }

    private updateIdMapping(item: ITestItem): void {
        const fsPath: string = Uri.parse(item.location.uri).fsPath;
        const testSet: Set<string> | undefined = this.idMappedByFsPath.get(fsPath);
        if (testSet) {
            testSet.add(item.id);
        } else {
            this.idMappedByFsPath.set(fsPath, new Set([item.id]));
        }
    }
}

export const testItemModel: TestItemModel = new TestItemModel();
