// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { QuickPickItem, window } from 'vscode';
import { ITestItem } from '../protocols';
import { IExecutionConfig, IExecutionConfigGroup } from '../runConfigs';
import { RunnerExecutor } from '../runners/runnerExecutor';
import { testConfigManager } from '../testConfigManager';

export async function runTests(runnerExecutor: RunnerExecutor, tests: ITestItem[], isDebug: boolean, isDefaultConfig: boolean): Promise<void> {
    const config: IExecutionConfig | undefined = await getTestConfig(tests, isDebug, isDefaultConfig);
    return runnerExecutor.run(tests, isDebug, config);
}

async function getTestConfig(tests: ITestItem[], isDebug: boolean, isDefaultConfig: boolean): Promise<IExecutionConfig | undefined> {
    const configGroups: IExecutionConfigGroup[] = await testConfigManager.loadRunConfig(tests, isDebug);
    if (isDefaultConfig) {
        return undefined;
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
