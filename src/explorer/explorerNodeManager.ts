// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable } from 'vscode';
import { TestLevel } from '../protocols';
import { TestTreeNode } from './TestTreeNode';

class ExplorerNodeManager implements Disposable {
    private explorerNodeMap: Map<string, TestTreeNode> = new Map<string, TestTreeNode>();

    public getNode(fsPath: string): TestTreeNode | undefined {
        return this.explorerNodeMap.get(fsPath);
    }

    public storeNodes(...nodes: TestTreeNode[]): void {
        for (const node of nodes) {
            if (node.level === TestLevel.Class) {
                this.explorerNodeMap.set(node.fsPath, node);
            }
        }
    }

    public removeNode(fsPath: string): void {
        this.explorerNodeMap.delete(fsPath);
    }

    public dispose(): void {
        this.explorerNodeMap.clear();
    }
}

export const explorerNodeManager: ExplorerNodeManager = new ExplorerNodeManager();
