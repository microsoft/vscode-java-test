// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
// tslint:disable-next-line
import { window, workspace, Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, ViewColumn, Command } from "vscode";
import * as Commands from '../commands';
import { TestLevel, TestSuite } from '../protocols';
import { TestResourceManager } from '../testResourceManager';
import { TestTreeNode, TestTreeNodeLevel } from "./testTreeNode";

export class TestExplorer implements TreeDataProvider<TestTreeNode> {
    private _onDidChangeTreeData: EventEmitter<TestTreeNode | undefined> = new EventEmitter<TestTreeNode | undefined>();
    // tslint:disable-next-line
    public readonly onDidChangeTreeData: Event<TestTreeNode | null> = this._onDidChangeTreeData.event;

    constructor(
        private _context: ExtensionContext,
        private _testCollectionStorage: TestResourceManager) {
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: TestTreeNode): TreeItem {
        return {
            label: element.name,
            collapsibleState: element.isFolder ? TreeItemCollapsibleState.Collapsed : void 0,
            command: this.getCommand(element),
            iconPath: this.getIconPath(element),
            contextValue: element.level.toString(),
        };
    }

    public getChildren(element?: TestTreeNode): TestTreeNode[] | Thenable<TestTreeNode[]> {
        if (element) {
            return element.children;
        }
        const tests: TestSuite[] = this._testCollectionStorage.getAll().filter((t) => t.level === TestLevel.Method);
        return this.createTestTreeNode(tests, undefined, TestTreeNodeLevel.Folder);
    }

    public select(element: TestTreeNode) {
        const editor = window.activeTextEditor;
        const uri = Uri.parse(element.uri);
        workspace.openTextDocument(uri).then((doc) => {
            return window.showTextDocument(doc, {
                    preserveFocus: true,
                    selection: element.range,
                });
        });
    }

    private createTestTreeNode(
        tests: TestSuite[],
        parent: TestTreeNode,
        level: TestTreeNodeLevel): TestTreeNode[] {
        if (level === TestTreeNodeLevel.Method) {
            return tests.map((t) => new TestTreeNode(this.getShortName(t), t.uri, t.range, parent, undefined));
        }
        const keyFunc: (_: TestSuite) => string = this.getGroupKeyFunc(level);
        const map = new Map<string, TestSuite[]>();
        tests.forEach((t) => {
            const key = keyFunc(t);
            const collection: TestSuite[] = map.get(key);
            if (!collection) {
                map.set(key, [t]);
            } else {
                collection.push(t);
            }
        });
        const children = [...map.entries()].map((value) => {
            const uri: string = level === TestTreeNodeLevel.Class ? value[1][0].uri : undefined;
            const c: TestTreeNode = new TestTreeNode(value[0], uri, undefined, parent, undefined, level);
            c.children = this.createTestTreeNode(value[1], c, level - 1);
            return c;
        });
        return children;
    }

    private getGroupKeyFunc(level: TestTreeNodeLevel): ((_: TestSuite) => string) {
        switch (level) {
            case TestTreeNodeLevel.Folder:
                return (_) => this.getWorkspaceFolder(_);
            case TestTreeNodeLevel.Package:
                return (_) => _.packageName;
            case TestTreeNodeLevel.Class:
                return (_) => this.getShortName(_.parent);
            default:
                throw new Error('Not supported group level');
        }
    }

    private getWorkspaceFolder(test: TestSuite): string {
        const folders = workspace.workspaceFolders;
        return folders.filter((f) => {
            const fp = Uri.parse(test.uri).fsPath;
            return fp.startsWith(f.uri.fsPath);
        }).map((f) => path.basename(f.uri.path))[0];
    }

    private getShortName(test: TestSuite): string {
        if (test.level === TestLevel.Method) {
            return test.test.substring(test.test.indexOf('#') + 1);
        } else {
            return test.test.substring(test.packageName.length + 1);
        }
    }

    private getIconPath(element: TestTreeNode): string | Uri | {dark: string | Uri, light: string | Uri} {
        switch (element.level) {
            case TestTreeNodeLevel.Method:
            return {
                dark: this._context.asAbsolutePath(path.join("resources", "media", "dark", "method.svg")),
                light: this._context.asAbsolutePath(path.join("resources", "media", "light", "method.svg")),
            };
            case TestTreeNodeLevel.Class:
            return {
                dark: this._context.asAbsolutePath(path.join("resources", "media", "dark", "class.svg")),
                light: this._context.asAbsolutePath(path.join("resources", "media", "light", "class.svg")),
            };
            case TestTreeNodeLevel.Package:
            return {
                dark: this._context.asAbsolutePath(path.join("resources", "media", "dark", "package.svg")),
                light: this._context.asAbsolutePath(path.join("resources", "media", "light", "package.svg")),
            };
            default:
            return undefined;
        }
    }

    private getCommand(element: TestTreeNode): Command | undefined {
        if (element.level <= TestTreeNodeLevel.Class) {
            return {
                command: Commands.JAVA_TEST_EXPLORER_SELECT,
                title: '',
                arguments: [element],
            };
        }
        return undefined;
    }
}
