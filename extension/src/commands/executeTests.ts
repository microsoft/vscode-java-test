// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, commands, Progress, ProgressLocation, QuickPickItem, window } from 'vscode';
import { JavaTestRunnerCommands } from '../constants/commands';
import { ITestItem } from '../protocols';
import { IExecutionConfig, IExecutionConfigGroup } from '../runConfigs';
import { runnerExecutor } from '../runners/runnerExecutor';
import { testConfigManager } from '../testConfigManager';

export async function runTests(tests: ITestItem[]): Promise<void> {
    return window.withProgress(
        { location: ProgressLocation.Notification, cancellable: true },
        (progress: Progress<any>, token: CancellationToken): Promise<void> => {
            return executeTests(tests, false /* isDebug */, true /* isDefaultConfig */, progress, token);
        },
    );
}

export async function debugTests(tests: ITestItem[]): Promise<void> {
    return window.withProgress(
        { location: ProgressLocation.Notification, cancellable: true },
        (progress: Progress<any>, token: CancellationToken): Promise<void> => {
            return executeTests(tests, true /* isDebug */, true /* isDefaultConfig */, progress, token);
        },
    );
}

export async function executeTests(tests: ITestItem[], isDebug: boolean, isDefaultConfig: boolean, progress: Progress<any>, token: CancellationToken): Promise<void> {
    const config: IExecutionConfig | undefined = await getTestConfig(tests, isDebug, isDefaultConfig);
    token.onCancellationRequested(() => {
        commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL);
    });
    progress.report({ message: 'Running tests...'});
    return runnerExecutor.run(tests, isDebug, config);
}

async function getTestConfig(tests: ITestItem[], isDebug: boolean, isDefaultConfig: boolean): Promise<IExecutionConfig | undefined> {
    const configGroups: IExecutionConfigGroup[] = await testConfigManager.loadRunConfig(tests, isDebug);
    if (isDefaultConfig) {
        if (configGroups.length !== 1 || !configGroups[0].default) {
            return undefined;
        }
        const runConfig: IExecutionConfigGroup = configGroups[0];
        const candidates: IExecutionConfig[] = runConfig.items.filter((item: IExecutionConfig) => item.name === runConfig.default);
        if (candidates.length === 0) {
            window.showWarningMessage(`There is no config with name: ${runConfig.default}.`);
            return undefined;
        }
        if (candidates.length > 1) {
            window.showWarningMessage(`Duplicate configs with default name: ${runConfig.default}.`);
        }
        return candidates[0];
    }

    if (configGroups.length > 1) {
        window.showWarningMessage('It is not supported to run tests with config from multi root.');
    }

    const configItems: IExecutionConfig[] = [];
    for (const config of configGroups) {
        configItems.push(...config.items);
    }
    const choices: IRunConfigQuickPick[] = [];
    for (const configItem of configItems) {
        choices.push({
            label: configItem.name,
            description: `Project name: ${configItem.projectName}`,
            item: configItem,
        });
    }
    const selection: IRunConfigQuickPick | undefined = await window.showQuickPick(choices, { placeHolder: 'Select test config' });
    if (!selection) {
        throw new Error('Please specify the test config to use!');
    }
    return selection.item;
}

interface IRunConfigQuickPick extends QuickPickItem {
    item: IExecutionConfig;
}
