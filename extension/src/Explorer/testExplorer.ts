// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { window, workspace, Command, Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { TestResourceManager } from '../testResourceManager';
import * as Commands from '../Constants/commands';
import { SearchResults, Test, TestSuite } from '../Models/protocols';
import { RunConfigItem } from '../Models/testConfig';
import { TestRunnerWrapper } from '../Runner/testRunnerWrapper';
import * as FetchTestsUtility from '../Utils/fetchTestUtility';
import { TestTreeNode, TestTreeNodeType } from './testTreeNode';

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
            collapsibleState: element.isMethod ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
            command: this.getCommand(element),
            iconPath: this.getIconPath(element),
            contextValue: element.type.toString(),
        };
    }

    public getChildren(element?: TestTreeNode): TestTreeNode[] | Promise<TestTreeNode[]> {
        if (!element) {
            const folders = workspace.workspaceFolders;
            return folders.map((folder) => new TestTreeNode(folder.name, folder.name, TestTreeNodeType.Folder, folder.uri.toString()));
        } else if (!element.children) {
            return new Promise(async (resolve: (res: TestTreeNode[]) => void): Promise<void> => {
                const results: SearchResults[] = await FetchTestsUtility.searchTestEntries({
                    nodeType: element.type,
                    uri: element.uri,
                    fullName: element.fullName,
                });
                const parentSuite: TestSuite = this.toTestSuite(element);
                if (parentSuite) {
                    const childSuites: TestSuite[] = results.map((result) => result.suite);
                    for (const childSuite of childSuites) {
                        childSuite.parent = parentSuite;
                    }
                    parentSuite.children = childSuites;
                    this.updateTestStorage(childSuites);
                }
                element.children = results.map((result) => new TestTreeNode(
                    result.displayName,
                    result.suite.test,
                    result.nodeType,
                    result.suite.uri,
                    result.suite.range,
                    element,
                ));
                resolve(element.children);
            });
        } else {
            return element.children;
        }
    }

    public select(element: TestTreeNode) {
        const uri = Uri.parse(element.uri);
        workspace.openTextDocument(uri).then((doc) => {
            return window.showTextDocument(doc, {
                    preserveFocus: true,
                    selection: element.range,
                });
        });
    }

    public run(element: TestTreeNode, debugMode: boolean, config?: RunConfigItem) {
        return TestRunnerWrapper.run(this.resolveTestSuites(element), debugMode, config);
    }

    public resolveTestSuites(element: TestTreeNode): TestSuite[] {
        if (!element) {
            return (this.getChildren(element) as TestTreeNode[]).map((f) => this.resolveTestSuites(f)).reduce((a, b) => a.concat(b));
        }
        if (element.type === TestTreeNodeType.Class || element.type === TestTreeNodeType.Method) {
            return[this.toTestSuite(element)];
        }
        return element.children.map((c) => this.resolveTestSuites(c)).reduce((a, b) => a.concat(b));
    }

    private updateTestStorage(tests: TestSuite[]) {
        if (!tests || tests.length === 0) {
            return;
        }
        const groupByUri: {} = tests.reduce((accumulator, currentVal) => {
            if (!accumulator[currentVal.uri]) {
                accumulator[currentVal.uri] = [];
            }
            accumulator[currentVal.uri].push(currentVal);
            return accumulator;
        }, {});
        for (const uri of Object.keys(groupByUri)) {
            this._testCollectionStorage.storeTests(Uri.parse(uri), groupByUri[uri]);
        }
    }

    private getIconPath(element: TestTreeNode): string | Uri | {dark: string | Uri, light: string | Uri} {
        switch (element.type) {
            case TestTreeNodeType.Method:
            return {
                dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'method.svg')),
                light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'method.svg')),
            };
            case TestTreeNodeType.Class:
            return {
                dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'class.svg')),
                light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'class.svg')),
            };
            case TestTreeNodeType.Package:
            return {
                dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'package.svg')),
                light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'package.svg')),
            };
            default:
            return undefined;
        }
    }

    private getCommand(element: TestTreeNode): Command | undefined {
        if (element.type === TestTreeNodeType.Class || element.type === TestTreeNodeType.Method) {
            return {
                command: Commands.JAVA_TEST_EXPLORER_SELECT,
                title: '',
                arguments: [element],
            };
        }
        return undefined;
    }

    private toTestSuite(element: TestTreeNode): TestSuite | undefined {
        const uri: Uri = Uri.parse(element.uri);
        const testData: Test | undefined = this._testCollectionStorage.getTests(uri);
        return testData ? testData.tests.filter((t) => t.test === element.fullName)[0] : undefined;
    }
}
