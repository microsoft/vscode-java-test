// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, window, ProgressLocation, StatusBarAlignment, StatusBarItem } from 'vscode';
import * as Commands from './Constants/commands';
import { TestLevel, TestStatus, TestSuite } from './Models/protocols';
import { CommandUtility } from './Utils/commandUtility';
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

    public show() {
        this.statusBarItem.show();
    }

    public update(tests: TestSuite[], action: Thenable<void>) {
        this.statusBarItem.text = `$(sync~spin) Running tests...`;
        this.statusBarItem.color = 'white';
        this.statusBarItem.tooltip = 'View test output';
        this.statusBarItem.command = Commands.JAVA_TEST_SHOW_OUTPUT;
        return window.withProgress({ location: ProgressLocation.Notification, title: 'Running tests', cancellable: true }, (p, token) => {
            token.onCancellationRequested(() => {
                Logger.info('User canceled the long running operation');
                commands.executeCommand(Commands.JAVA_TEST_CANCEL);
            });
            p.report({ message: 'Running tests...', increment: 0 });
            return action.then(() => {
                this.updateStatus(tests);
                p.report({ increment: 100 });
            },
            (reason) => {
                this.statusBarItem.text = 'Failed to run tests';
                this.statusBarItem.color = 'red';
                if (tests) {
                    this.statusBarItem.command = CommandUtility.getCommandWithArgs(Commands.JAVA_TEST_SHOW_REPORT, [tests]);
                }
                Logger.error('Failed to run tests.', {
                    error: reason,
                });
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
        this.statusBarItem.text = `$(x) ${failedCount} $(check) ${passedCount}`;
        this.statusBarItem.color = failedCount > 0 ? 'red' : '#66ff66';
        this.statusBarItem.tooltip = 'View test report';
        this.statusBarItem.command = CommandUtility.getCommandWithArgs(Commands.JAVA_TEST_SHOW_REPORT, [tests]);
    }
}
