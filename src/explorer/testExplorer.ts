// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { Command, Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace, WorkspaceFolder } from 'vscode';
import { JavaTestRunnerCommands } from '../constants/commands';
import { ISearchTestItemParams, ITestItem, TestLevel } from '../protocols';
import { searchTestItems } from '../utils/commandUtils';
import { constructSearchTestItemParams } from '../utils/protocolUtils';
import { explorerNodeManager } from './explorerNodeManager';
import { TestTreeNode } from './TestTreeNode';

export class TestExplorer implements TreeDataProvider<TestTreeNode> {
    public readonly testExplorerViewId: string = 'testExplorer';

    private onDidChangeTreeDataEventEmitter: EventEmitter<TestTreeNode | null| undefined> = new EventEmitter<TestTreeNode | null | undefined>();
    // tslint:disable-next-line:member-ordering
    public readonly onDidChangeTreeData: Event<TestTreeNode | null | undefined> = this.onDidChangeTreeDataEventEmitter.event;

    private _context: ExtensionContext;

    public initialize(context: ExtensionContext): void {
        this._context = context;
    }

    public getTreeItem(element: TestTreeNode): TreeItem | Thenable<TreeItem> {
        return {
            label: element.name,
            collapsibleState: this.resolveCollapsibleState(element),
            command: this.resolveCommand(element),
            iconPath: this.resolveIconPath(element),
            contextValue: element.level.toString(),
        };
    }

    public async getChildren(element?: TestTreeNode): Promise<TestTreeNode[]> {
        let children: TestTreeNode[] = [];
        if (!element) {
            const folders: WorkspaceFolder[] | undefined = workspace.workspaceFolders;
            if (folders) {
                children = folders.map((folder: WorkspaceFolder) => new TestTreeNode(folder.name, folder.name, TestLevel.Folder, folder.uri.fsPath));
            }
        } else {
            if (!element.children) {
                element.children = await this.getChildrenOfTreeNode(element);
                explorerNodeManager.storeNodes(...element.children);
            }
            children = element.children;
        }
        return children.sort((a: TestTreeNode, b: TestTreeNode) => a.name.localeCompare(b.name));
    }

    public refresh(element?: TestTreeNode): void {
        if (element) {
            element.children = undefined;
        }
        this.onDidChangeTreeDataEventEmitter.fire(element);
    }

    private async getChildrenOfTreeNode(element: TestTreeNode): Promise<TestTreeNode[]> {
        const searchParams: ISearchTestItemParams = constructSearchTestItemParams(element);
        const results: ITestItem[] = await searchTestItems(searchParams);
        return results.map((result: ITestItem) => new TestTreeNode(
            result.displayName,
            result.fullName,
            result.level,
            Uri.parse(result.location.uri).fsPath,
            result.location.range,
        ));
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

    private resolveCommand(element: TestTreeNode): Command | undefined {
        if (element.level >= TestLevel.Class) {
            return {
                command: JavaTestRunnerCommands.OPEN_DOCUMENT,
                title: '',
                arguments: [Uri.file(element.fsPath), element.range],
            };
        }
        return undefined;
    }
}

export const testExplorer: TestExplorer = new TestExplorer();
