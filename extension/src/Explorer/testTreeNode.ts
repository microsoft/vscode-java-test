// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from "vscode";

export class TestTreeNode {
    constructor(
        private _name: string,
        private _uri?: string,
        private _range?: Range,
        private _parent?: TestTreeNode,
        private _children?: TestTreeNode[],
        private _level: TestTreeNodeType = TestTreeNodeType.Method) {
    }

    public get name(): string {
        return this._name;
    }

    public get fullName(): string {
        const prefix: string = this._parent && this._parent.level !== TestTreeNodeType.Folder ? `${this._parent.fullName}` : "";
        if (prefix === '') {
            return this._name;
        }
        return prefix + (this.level === TestTreeNodeType.Method ? "#" : ".") + this._name;
    }

    public get uri(): string {
        return this._uri;
    }

    public get range(): Range {
        return this._range;
    }

    public get isFolder(): boolean {
        return this.level !== TestTreeNodeType.Method;
    }

    public get children(): TestTreeNode[] {
        return this._children;
    }

    public set children(c: TestTreeNode[]) {
        this._children = c;
    }

    public get parent(): TestTreeNode {
        return this._parent;
    }

    public set parent(c: TestTreeNode) {
        this._parent = c;
    }

    public get level(): TestTreeNodeType {
        return this._level;
    }
}

export enum TestTreeNodeType {
    Method,
    Class,
    Package,
    Folder,
}
