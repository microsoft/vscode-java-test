// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ITestResult, TestStatus } from './runners/models';

class TestStatusBarProvider implements Disposable {
    private readonly statusBarItem: StatusBarItem;

    constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_VALUE);
    }

    public show(): void {
        this.statusBarItem.show();
    }

    public showRunningTest(): void {
        this.update('$(sync~spin) Running tests...', 'Show test output', JavaTestRunnerCommands.SHOW_TEST_OUTPUT);
    }

    public showFailure(): void {
        this.update('$(issue-opened) Failed to run tests', 'Show test output', JavaTestRunnerCommands.SHOW_TEST_OUTPUT);
    }

    public showTestResult(results: ITestResult[]): void {
        if (results.length === 0) {
            this.statusBarItem.hide();
            return;
        }

        let failedNum: number = 0;
        let passedNum: number = 0;
        for (const result of results) {
            if (result.status === TestStatus.Fail) {
                failedNum++;
            } else if (result.status === TestStatus.Pass) {
                passedNum++;
            }
        }

        this.update(`$(x) ${failedNum} $(check) ${passedNum}`, 'Show test report', JavaTestRunnerCommands.SHOW_TEST_REPORT, [results]);
    }

    public update(text: string, tooltip?: string, command?: string, args?: any[]): void {
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        if (command) {
            this.statusBarItem.command = {
                title: text,
                command,
                arguments: args,
            };
        }
        this.statusBarItem.show();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}

export const testStatusBarProvider: TestStatusBarProvider = new TestStatusBarProvider();
