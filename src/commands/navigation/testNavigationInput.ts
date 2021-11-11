// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, ProviderResult } from 'vscode';
import { SymbolTreeInput, SymbolTreeModel } from '../../references-view';
import { ITestNavigationItem } from './navigationCommands';
import { TestNavigationTreeDataProvider } from './TestNavigationTreeDataProvider';

export class TestNavigationInput implements SymbolTreeInput<ITestNavigationItem> {
    readonly title: string;
    readonly location: Location;
    readonly contextValue: string = 'javaTestNavigation';
    items: ITestNavigationItem[];


    constructor(title: string, location: Location, items: ITestNavigationItem[]) {
        this.title = title;
        this.location = location;
        this.items = items;
    }

    resolve(): ProviderResult<SymbolTreeModel<ITestNavigationItem>> {
        const provider: TestNavigationTreeDataProvider = new TestNavigationTreeDataProvider(this.items);
        const treeModel: SymbolTreeModel<ITestNavigationItem> = {
            message: undefined,
            provider,
        };
        return treeModel;
    }

    with(location: Location): SymbolTreeInput<ITestNavigationItem> {
        return new TestNavigationInput(this.title, location, this.items);
    }
}
