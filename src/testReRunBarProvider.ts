// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Disposable, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ITestResult } from './runners/models';

class TestReRunBarProvider implements Disposable {
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
      this.update('----', 'View test output');
    }

    public showFailure(): void {
      this.update('$(issue-opened) Re-Run Test', 'Re-Run the Test', JavaTestRunnerCommands.RUN_TEST_FROM_STATUS);
    }

    public showTestResult(results: ITestResult[]): void {

      this.update(`$(check) $(issue-opened) Re-Run Test`, 'Re-Run the Test', this.getCommandWithArgs(JavaTestRunnerCommands.RUN_TEST_FROM_STATUS, [results]));
    }

    public update(text: string, tooltip?: string, command?: string, args?: any[]): void {
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.command = this.getCommandWithArgs(command, args);
        this.statusBarItem.show();
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

export const testReRunBarProvider: TestReRunBarProvider = new TestReRunBarProvider();
