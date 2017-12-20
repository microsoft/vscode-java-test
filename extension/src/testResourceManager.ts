// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, workspace, Event, EventEmitter, Uri } from 'vscode';
import * as Commands from './commands';
import * as FetchTestsUtility from './fetchTestUtility';
import { Logger } from './logger';
import { Test, TestSuite } from './protocols';

export class TestResourceManager {
    private testsIndexedByFileUri = new Map<string, Test | null | undefined>();
    private readonly _onDidChangeTestStorage: EventEmitter<void> = new EventEmitter<void>();
    // tslint:disable-next-line
    public readonly onDidChangeTestStorage: Event<void> = this._onDidChangeTestStorage.event;

    constructor(private _logger: Logger) {
    }

    public getTests(file: Uri): Test | undefined {
        const path = file.fsPath || '';
        return this.testsIndexedByFileUri.has(path) ? this.testsIndexedByFileUri.get(path) : undefined;
    }
    public storeTests(file: Uri, tests: TestSuite[] | null | undefined): void {
        const path = file.fsPath || '';
        const test: Test = {
            dirty: false,
            tests,
        };
        this.testsIndexedByFileUri.set(path, test);
        this._onDidChangeTestStorage.fire();
    }
    public setDirty(file: Uri): void {
        const test = this.getTests(file);
        if (test) {
            test.dirty = true;
        }
    }
    public isDirty(file: Uri): boolean | undefined {
        const test = this.getTests(file);
        return test ? test.dirty : undefined;
    }
    public getAll(): TestSuite[] {
        let allTests: TestSuite[] = [];
        this.testsIndexedByFileUri.forEach((value, key, m) => {
            allTests = allTests.concat(value.tests);
        });
        return allTests;
    }
    public refresh(): Thenable<void> {
        return FetchTestsUtility.searchAllTests().then((tests: TestSuite[]) => {
            this.testsIndexedByFileUri.clear();
            const map = new Map<string, TestSuite[]>();
            tests.forEach((test) => {
                const key: string = test.uri;
                const collection: TestSuite[] = map.get(key);
                if (!collection) {
                    map.set(key, [test]);
                } else {
                    collection.push(test);
                }
            });
            map.forEach((value, key, m) => {
                this.storeTests(Uri.parse(key), value);
            });
        },
        (reason) => {
            this._logger.logError(`Failed to refresh test storage. Details: ${reason}.`);
            return Promise.reject(reason);
        });
    }
    public dispose() {
        this.testsIndexedByFileUri.clear();
    }
}
