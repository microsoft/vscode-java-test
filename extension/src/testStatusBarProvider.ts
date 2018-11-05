// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Disposable, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ITestResult, TestStatus } from './runners/models';

class TestStatusBarProvider implements Disposable {
    private readonly statusBarItem: StatusBarItem;
    private readonly commandCache: Map<string, Disposable>;

    constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_VALUE);
        this.commandCache = new Map<string, Disposable>();
    }

    public show(): void {
        this.statusBarItem.show();
    }

    public showRunningTest(): void {
        this.update('$(sync~spin) Running tests...', 'white', 'View test output', JavaTestRunnerCommands.SHOW_TEST_OUTPUT);
    }

    public showRunningFail(): void {
        this.update('Failed to run tests', 'red', 'View test output', JavaTestRunnerCommands.SHOW_TEST_OUTPUT);
    }

    public showTestResult(results: ITestResult[]): void {
        let failedNum: number = 0;
        let passedNum: number = 0;
        for (const result of results) {
            if (result.result.status === TestStatus.Fail) {
                failedNum++;
            } else if (result.result.status === TestStatus.Pass) {
                passedNum++;
            }
        }

        this.statusBarItem.text = `$(x) ${failedNum} $(check) ${passedNum}`;
        this.statusBarItem.color = failedNum > 0 ? 'red' : '#66ff66';
        this.statusBarItem.tooltip = 'View test report';
        this.statusBarItem.command = this.getCommandWithArgs(JavaTestRunnerCommands.SHOW_TEST_REPORT, [results]);
    }

    public update(text: string, color?: string, tooltip?: string, command?: string, args?: any[]): void {
        this.statusBarItem.text = text;
        this.statusBarItem.color = color;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.command = this.getCommandWithArgs(command, args);
    }

    public dispose(): void {
        this.statusBarItem.dispose();
        for (const disposable of this.commandCache.values()) {
            disposable.dispose();
        }
        this.commandCache.clear();
    }

    private getCommandWithArgs(command?: string, args?: any[]): string | undefined {
        if (!args) {
            return command;
        }
        const commandWithArgs: string = `${command}-args`;
        const registeredCommand: Disposable | undefined = this.commandCache.get(commandWithArgs);
        if (registeredCommand) {
            registeredCommand.dispose();
        }

        this.commandCache.set(commandWithArgs, commands.registerCommand(commandWithArgs, () => {
            commands.executeCommand(command as string, ...args);
        }));

        return commandWithArgs;
    }
}

export const testStatusBarProvider: TestStatusBarProvider = new TestStatusBarProvider();
