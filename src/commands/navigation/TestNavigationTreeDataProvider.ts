// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import {  ProviderResult, TreeDataProvider, TreeItem, Uri } from 'vscode';
import { ITestNavigationItem } from './navigationCommands';

export class TestNavigationTreeDataProvider implements TreeDataProvider<ITestNavigationItem> {
    items: ITestNavigationItem[]

    constructor(items: ITestNavigationItem[]) {
        this.items = items;
    }

    getTreeItem(element: ITestNavigationItem): TreeItem | Thenable<TreeItem> {
        const treeItem: TreeItem = new TreeItem(element.simpleName);
        treeItem.resourceUri = Uri.file(element.uri);
        treeItem.description = element.fullyQualifiedName;
        treeItem.command = {
            command: 'vscode.open',
            title: 'Open Type Location',
            arguments: [
                Uri.parse(element.uri)
            ]
        }
        return treeItem;
    }

    getChildren(element?: ITestNavigationItem): ProviderResult<ITestNavigationItem[]> {
        if (!element) {
            return this.items;
        }

        return undefined;
    }
}
