// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { window, StatusBarAlignment, StatusBarItem } from "vscode";

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

    public init(action: Thenable<void>): Thenable<void> {
        this.statusBarItem.text = 'Loading tests...';
        this.statusBarItem.show();
        return action.then(() => {
            this.statusBarItem.hide();
        },
        (reason) => {
            this.statusBarItem.text = 'Failed to load tests';
        });
    }

    public update(tests: TestSuite[]): void {
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
        this.statusBarItem.show();
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
