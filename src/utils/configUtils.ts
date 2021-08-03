// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as crypto from 'crypto';
import * as _ from 'lodash';
import { ConfigurationTarget, QuickPickItem, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { Configurations, Dialog } from '../constants';
import { extensionContext } from '../extension';
import { getBuiltinConfig, IExecutionConfig } from '../runConfigs';

export async function loadRunConfig(workspaceFolder: WorkspaceFolder): Promise<IExecutionConfig | undefined> {
    const configSetting: IExecutionConfig[] | IExecutionConfig = workspace.getConfiguration(undefined, workspaceFolder.uri).get<IExecutionConfig[] | IExecutionConfig>(Configurations.CONFIG_SETTING_KEY, {});
    const configItems: IExecutionConfig[] = [];
    if (!_.isEmpty(configSetting)) {
        if (_.isArray(configSetting)) {
            configItems.push(...configSetting);
        } else if (_.isPlainObject(configSetting)) {
            configItems.push(configSetting);
        }
    }

    const defaultConfigName: string | undefined = workspace.getConfiguration(undefined, workspaceFolder.uri).get<string>(Configurations.DEFAULT_CONFIG_NAME_SETTING_KEY);
    if (defaultConfigName) {
        if (defaultConfigName === Configurations.BUILTIN_CONFIG_NAME) {
            sendInfo('', { usingDefaultConfig: 1 });
            return getBuiltinConfig();
        }

        const defaultConfigs: IExecutionConfig[] = configItems.filter((config: IExecutionConfig) => {
            return config.name === defaultConfigName;
        });
        if (defaultConfigs.length === 0) {
            window.showWarningMessage(`Failed to find the default configuration item: ${defaultConfigName}, use the empty configuration instead.`);
            return {};
        } else if (defaultConfigs.length > 1) {
            window.showWarningMessage(`More than one configuration item found with name: ${defaultConfigName}, use the empty configuration instead.`);
            return {};
        } else {
            return defaultConfigs[0];
        }
    }
    return await selectQuickPick(configItems, workspaceFolder);
}

async function selectQuickPick(configs: IExecutionConfig[], workspaceFolder: WorkspaceFolder): Promise<IExecutionConfig | undefined> {
    if (configs.length === 0) {
        return {};
    }

    interface IRunConfigQuickPick extends QuickPickItem {
        item: IExecutionConfig;
    }

    const choices: IRunConfigQuickPick[] = [];
    for (let i: number = 0; i < configs.length; i++) {
        const label: string = configs[i].name ? configs[i].name! : `Configuration #${i + 1}`;
        choices.push({
            label,
            detail: JSON.stringify(configs[i]),
            item: configs[i],
        });
    }
    if (choices.length === 1) {
        return choices[0].item;
    }
    const selection: IRunConfigQuickPick | undefined = await window.showQuickPick(choices, {
        ignoreFocusOut: true,
        placeHolder: `Select test configuration for workspace folder: "${workspaceFolder.name}"`,
    });
    if (!selection) {
        return undefined;
    }

    askPreferenceForConfig(configs, selection.item, workspaceFolder.uri);

    return selection.item;
}

async function askPreferenceForConfig(configs: IExecutionConfig[], selectedConfig: IExecutionConfig, workspaceFolderUri: Uri): Promise<void> {
    const workspaceConfiguration: WorkspaceConfiguration = workspace.getConfiguration(undefined, workspaceFolderUri);
    const showHint: boolean | undefined = extensionContext.globalState.get<boolean>(Configurations.HINT_FOR_DEFAULT_CONFIG_SETTING_KEY);
    if (!showHint) {
        return;
    }
    const choice: string | undefined = await window.showInformationMessage('Would you like to set this configuration as default?', Dialog.YES, Dialog.NO, Dialog.NEVER_SHOW);
    if (!choice || choice === Dialog.NO) {
        return;
    } else if (choice === Dialog.NEVER_SHOW) {
        await extensionContext.globalState.update(Configurations.HINT_FOR_DEFAULT_CONFIG_SETTING_KEY, false);
        return;
    }
    if (selectedConfig.name) {
        workspaceConfiguration.update(Configurations.DEFAULT_CONFIG_NAME_SETTING_KEY, selectedConfig.name, ConfigurationTarget.WorkspaceFolder);
    } else {
        const randomName: string = `config-${randomSequence()}`;
        selectedConfig.name = randomName;
        workspaceConfiguration.update(Configurations.DEFAULT_CONFIG_NAME_SETTING_KEY, selectedConfig.name, ConfigurationTarget.WorkspaceFolder);
        workspaceConfiguration.update(Configurations.CONFIG_SETTING_KEY, configs, ConfigurationTarget.WorkspaceFolder);
    }
}

export function randomSequence(): string {
    return crypto.randomBytes(3).toString('hex');
}
