// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { window, ProgressLocation, StatusBarAlignment, StatusBarItem } from "vscode";

import * as Commands from "./Constants/commands";
import { TestLevel, TestStatus, TestSuite } from "./Models/protocols";
import { CommandUtility } from "./Utils/commandUtility";
import * as Logger from './Utils/Logger/logger';

export class TestStatusBarProvider {
    public static getInstance(): TestStatusBarProvider {
        return TestStatusBarProvider.instance;
    }
    private static readonly instance: TestStatusBarProvider = new TestStatusBarProvider();

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
                Logger.error('Failed to load tests.', {
                    error: reason,
                });
            });
        });
    }

    public update(tests: TestSuite[], action: Thenable<void>) {
        this.statusBarItem.text = `$(sync~spin) Running tests...`;
        this.statusBarItem.color = 'white';
        this.statusBarItem.tooltip = 'View test output';
        this.statusBarItem.command = Commands.JAVA_TEST_SHOW_OUTPUT;
        return action.then(() => this.updateStatus(tests),
        (reason) => {
            this.statusBarItem.text = 'Failed to run tests';
            this.statusBarItem.color = 'red';
            Logger.error('Failed to run tests.', {
                error: reason,
            });
            return Promise.reject(reason);
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
        this.statusBarItem.text = `$(x) ${failedCount} $(check) ${passedCount}`;
        this.statusBarItem.color = failedCount > 0 ? 'red' : '#66ff66';
        this.statusBarItem.tooltip = 'View test report';
        this.statusBarItem.command = CommandUtility.getCommandWithArgs(Commands.JAVA_TEST_SHOW_REPORT, [tests]);
    }
}
