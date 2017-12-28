// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { window, ProgressLocation, StatusBarAlignment, StatusBarItem } from "vscode";

import * as Commands from "./commands";
import { TestLevel, TestStatus, TestSuite } from "./protocols";

export class TestStatusBarSingleton {
    public static getInstance(): TestStatusBarSingleton {
        return TestStatusBarSingleton.instance;
    }
    private static readonly instance: TestStatusBarSingleton = new TestStatusBarSingleton();

    private statusBarItem: StatusBarItem;

    private constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_VALUE);
    }

    public dispose() {
        this.statusBarItem.dispose();
    }

    public init(action: Thenable<void>): Thenable<void> {
        return window.withProgress({ location: ProgressLocation.Window }, (p) => {
            p.report({message: 'Loading tests...'});
            this.statusBarItem.show();
            return action.then(null,
            (reason) => {
                this.statusBarItem.text = 'Failed to load tests';
            });
        });
    }

    public update(tests: TestSuite[], action: Thenable<void>) {
        return window.withProgress({ location: ProgressLocation.Window }, async (p) => {
            p.report({message: 'Running/Debugging test...'});
            this.statusBarItem.text = 'View test output';
            this.statusBarItem.command = Commands.JAVA_TEST_SHOW_OUTPUT;
            return action.then(() => this.updateStatus(tests),
            (reason) => {
                this.statusBarItem.text = 'Failed to run tests';
                return Promise.reject(reason);
            });
        });
    }

    private updateStatus(tests: TestSuite[]): void {
        const testMethods: TestSuite[] = tests.map((t) => t.level === TestLevel.Method ? [t] : t.children)
                                              .reduce((a, b) => a.concat(b));
        let failedCount: number = 0;
        let passedCount: number = 0;
        for (const t of testMethods) {
            if (t.level !== TestLevel.Method || !t.result) {
                continue;
            }
            if (t.result.status === TestStatus.Fail) {
                failedCount++;
            } else if (t.result.status === TestStatus.Pass) {
                passedCount++;
            }
        }
        this.statusBarItem.text = `$(x)${failedCount}  $(check)${passedCount}`;
        this.statusBarItem.command = Commands.JAVA_TEST_SHOW_OUTPUT;
    }
}
