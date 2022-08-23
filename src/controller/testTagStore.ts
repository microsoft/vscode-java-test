// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { injectable } from 'inversify';
import { TestTag } from 'vscode';

// tslint:disable-next-line: typedef
export const ITestTagStore = Symbol('ITestTagStore');
export interface ITestTagStore {
    getTestTag(id: string): TestTag;
    getRunnableTag(): TestTag;
}

@injectable()
export class TestTagStore implements ITestTagStore {
    private store: Map<string, TestTag> = new Map();
    private runnableTag: TestTag = new TestTag('runnable');

    public getTestTag(id: string): TestTag {
        let tag: TestTag | undefined = this.store.get(id);
        if (!tag) {
            tag = new TestTag(id);
            this.store.set(id, tag);
        }
        return tag;
    }

    public getRunnableTag(): TestTag {
        return this.runnableTag;
    }
}
