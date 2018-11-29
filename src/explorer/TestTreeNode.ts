// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';
import { TestLevel } from '../protocols';

export class TestTreeNode {
    constructor(
        private _name: string,
        private _fullName: string,
        private _level: TestLevel,
        private _fsPath: string,
        private _range?: Range,
        private _children?: TestTreeNode[]) {
    }

    public get name(): string {
        return this._name;
    }

    public get fullName(): string {
        return this._fullName;
    }

    public get fsPath(): string {
        return this._fsPath;
    }

    public get range(): Range | undefined {
        return this._range;
    }

    public get isMethod(): boolean {
        return this.level === TestLevel.Method;
    }

    public get level(): TestLevel {
        return this._level;
    }

    public get children(): TestTreeNode[] | undefined {
        return this._children;
    }

    public set children(children: TestTreeNode[] | undefined) {
        this._children = children;
    }
}
