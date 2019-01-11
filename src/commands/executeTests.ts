// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, commands, Progress, ProgressLocation, window } from 'vscode';
import { JavaTestRunnerCommands } from '../constants/commands';
import { ITestItem } from '../protocols';
import { runnerExecutor } from '../runners/runnerExecutor';

export async function runTests(tests: ITestItem[]): Promise<void> {
    return window.withProgress(
        { location: ProgressLocation.Notification, cancellable: true },
        (progress: Progress<any>, token: CancellationToken): Promise<void> => {
            return executeTests(tests, false /* isDebug */, progress, token);
        },
    );
}

export async function debugTests(tests: ITestItem[]): Promise<void> {
    return window.withProgress(
        { location: ProgressLocation.Notification, cancellable: true },
        (progress: Progress<any>, token: CancellationToken): Promise<void> => {
            return executeTests(tests, true /* isDebug */, progress, token);
        },
    );
}

export async function executeTests(tests: ITestItem[], isDebug: boolean, progress: Progress<any>, token: CancellationToken): Promise<void> {
    token.onCancellationRequested(() => {
        commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL);
    });
    progress.report({ message: 'Running tests...'});
    return runnerExecutor.run(tests, isDebug);
}
