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
        private _level: TestTreeNodeLevel = TestTreeNodeLevel.Method) {
    }

    public get name(): string {
        return this._name;
    }

    public get fullName(): string {
        return (this._parent ? `${this._parent.fullName}` + (this.level === TestTreeNodeLevel.Method ? "#" : ".") : "") + this._name;
    }

    public get uri(): string {
        return this._uri;
    }

    public get range(): Range {
        return this._range;
    }

    public get isFolder(): boolean {
        return this.level !== TestTreeNodeLevel.Method;
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

    public get level(): TestTreeNodeLevel {
        return this._level;
    }
}

export enum TestTreeNodeLevel {
    Method,
    Class,
    Package,
    Folder,
}
