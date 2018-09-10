// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';

export class TestTreeNode {
    constructor(
        private _name: string,
        private _fullName: string,
        private _type: TestTreeNodeType,
        private _uri?: string,
        private _range?: Range,
        private _parent?: TestTreeNode,
        private _children?: TestTreeNode[]) {
    }

    public get name(): string {
        return this._name;
    }

    public get fullName(): string {
        return this._fullName;
    }

    public get uri(): string {
        return this._uri;
    }

    public get range(): Range {
        return this._range;
    }

    public get isMethod(): boolean {
        return this.type === TestTreeNodeType.Method;
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

    public get type(): TestTreeNodeType {
        return this._type;
    }
}

export enum TestTreeNodeType {
    Method = 0,
    Class = 1,
    Package = 2,
    Folder = 3,
}
