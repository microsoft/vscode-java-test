// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { Event, EventEmitter, ExtensionContext, ProviderResult, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace, WorkspaceFolder } from 'vscode';
import { ITestItem, TestLevel } from '../protocols';
import { searchTestItems } from '../utils/commandUtils';
import { serializeSearchChildrenNodeRequest } from '../utils/protocolUtils';
import { TestTreeNode } from './TestTreeNode';

export class TestExplorer implements TreeDataProvider<TestTreeNode> {
    public readonly testExplorerViewId: string = 'testExplorer';

    private onDidChangeTreeDataEventEmitter: EventEmitter<TestTreeNode | null| undefined> = new EventEmitter<TestTreeNode | null| undefined>();
    // tslint:disable-next-line:member-ordering
    public readonly onDidChangeTreeData: Event<TestTreeNode | null | undefined> = this.onDidChangeTreeDataEventEmitter.event;

    private _context: ExtensionContext;

    public getTreeItem(element: TestTreeNode): TreeItem | Thenable<TreeItem> {
        return {
            label: element.name,
            collapsibleState: this.resolveCollapsibleState(element),
            iconPath: this.resolveIconPath(element),
            contextValue: element.level.toString(),
        };
    }

    public getChildren(element?: TestTreeNode): ProviderResult<TestTreeNode[]> {
        if (!element) {
            const folders: WorkspaceFolder[] | undefined = workspace.workspaceFolders;
            if (folders) {
                return folders.map((folder: WorkspaceFolder) => new TestTreeNode(folder.name, folder.name, TestLevel.Folder, folder.uri.fsPath));
            }
            return [];
        } else if (element.children) {
            return element.children;
        }

        return new Promise(async (resolve: (res: TestTreeNode[]) => void): Promise<void> => {
            const requestString: string = serializeSearchChildrenNodeRequest(element);
            const results: ITestItem[] = await searchTestItems(requestString);
            element.children = results.map((result: ITestItem) => new TestTreeNode(
                result.displayName,
                result.fullName,
                result.level,
                Uri.parse(result.uri).fsPath,
                result.range,
                element,
            ));
            resolve(element.children);
        });
    }

    public refresh(element?: TestTreeNode): void {
        if (element) {
            element.children = undefined;
        }
        this.onDidChangeTreeDataEventEmitter.fire(element);
    }

    public set context(context: ExtensionContext) {
        this._context = context;
    }

    private resolveCollapsibleState(element: TestTreeNode): TreeItemCollapsibleState {
        if (element.isMethod) {
            return TreeItemCollapsibleState.None;
        }
        return TreeItemCollapsibleState.Collapsed;
    }

    private resolveIconPath(element: TestTreeNode): undefined | { dark: string | Uri, light: string | Uri } {
        switch (element.level) {
            case TestLevel.Method:
                return {
                    dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'method.svg')),
                    light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'method.svg')),
                };
            case TestLevel.Class:
            case TestLevel.NestedClass:
                return {
                    dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'class.svg')),
                    light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'class.svg')),
                };
            case TestLevel.Package:
                return {
                    dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'package.svg')),
                    light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'package.svg')),
                };
            default:
                return undefined;
        }
    }
}

export const testExplorer: TestExplorer = new TestExplorer();
