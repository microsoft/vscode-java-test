// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as crypto from 'crypto';
import * as fse from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import { commands, ConfigurationTarget, QuickPickItem, TextDocument, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { BUILTIN_CONFIG_NAME, CONFIG_DOCUMENT_URL, CONFIG_SETTING_KEY, DEFAULT_CONFIG_NAME_SETTING_KEY, HINT_FOR_DEFAULT_CONFIG_SETTING_KEY } from '../constants/configs';
import { LEARN_MORE, NEVER_SHOW, NO, OPEN_SETTING, YES } from '../constants/dialogOptions';
import { logger } from '../logger/logger';
import { __BUILTIN_CONFIG__, IExecutionConfig, ITestConfig } from '../runConfigs';

export async function loadRunConfig(workspaceFolder: WorkspaceFolder | undefined): Promise<IExecutionConfig | undefined> {
    if (!workspaceFolder) {
        window.showErrorMessage('Failed to get workspace folder for the test items.');
        return undefined;
    }

    const configSetting: IExecutionConfig[] | IExecutionConfig = workspace.getConfiguration(undefined, workspaceFolder.uri).get<IExecutionConfig[] | IExecutionConfig>(CONFIG_SETTING_KEY, {});
    if (!_.isEmpty(configSetting)) {
        // Use the new config schema
        const configItems: IExecutionConfig[] = [];
        if (_.isArray(configSetting)) {
            configItems.push(...configSetting);
        } else if (_.isPlainObject(configSetting)) {
            configItems.push(configSetting);
        }

        const defaultConfigName: string | undefined = workspace.getConfiguration(undefined, workspaceFolder.uri).get<string>(DEFAULT_CONFIG_NAME_SETTING_KEY);
        if (defaultConfigName) {
            if (defaultConfigName === BUILTIN_CONFIG_NAME) {
                return __BUILTIN_CONFIG__;
            }
            const defaultConfigs: IExecutionConfig[] = configItems.filter((config: IExecutionConfig) => {
                return config.name === defaultConfigName;
            });
            if (defaultConfigs.length === 0) {
                window.showWarningMessage(`Failed to find the default configuration item: ${defaultConfigName}, use the built-in configuration instead.`);
                return __BUILTIN_CONFIG__;
            } else if (defaultConfigs.length > 1) {
                window.showWarningMessage(`More than one configuration item found with name: ${defaultConfigName}, use the built-in configuration instead.`);
                return __BUILTIN_CONFIG__;
            } else {
                return defaultConfigs[0];
            }
        }
        return await selectQuickPick(configItems, workspaceFolder);
    }
    return __BUILTIN_CONFIG__;
}

export async function migrateTestConfig(): Promise<void> {
    const deprecatedConfigs: Uri[] = await workspace.findFiles('**/.vscode/launch.test.json');
    if (deprecatedConfigs.length === 0) {
        window.showInformationMessage('No deprecated launch.test.json found in current workspace.');
        return;
    }
    const deprecatedConfigPath: string[] = deprecatedConfigs.map((uri: Uri) => uri.fsPath);
    const selectedConfig: string[] | undefined = await window.showQuickPick(deprecatedConfigPath, {
        ignoreFocusOut: true,
        placeHolder: 'Select the configuration(s) you want to migrate',
        canPickMany: true,
    });
    if (!selectedConfig) {
        return;
    }
    for (const config of selectedConfig) {
        try {
            await migrate(config);
        } catch (error) {
            await window.showErrorMessage(`Failed to migrate the configuration file: ${config}`);
        }
    }
    const choice: string | undefined = await window.showInformationMessage("Migration finished, would you like to remove the deprecated 'launch.test.json' file(s)?", YES, OPEN_SETTING, LEARN_MORE);
    if (choice === YES) {
        for (const config of selectedConfig) {
            await fse.remove(config);
        }
        window.showInformationMessage("Successfully removed the deprecated 'launch.test.json' file(s).");
    } else if (choice === OPEN_SETTING) {
        for (const config of selectedConfig) {
            const settingUri: Uri = Uri.file(path.join(config, '..', 'settings.json'));
            if (await !fse.existsSync(settingUri.fsPath)) {
                logger.error(`workspace setting not found: ${settingUri.fsPath}`);
                continue;
            }
            const document: TextDocument = await workspace.openTextDocument(settingUri);
            await window.showTextDocument(document, { preview: false });
        }
    } else if (choice === LEARN_MORE) {
        commands.executeCommand('vscode.open', Uri.parse(CONFIG_DOCUMENT_URL));
    }
}

async function selectQuickPick(configs: IExecutionConfig[], workspaceFolder: WorkspaceFolder): Promise<IExecutionConfig | undefined> {
    interface IRunConfigQuickPick extends QuickPickItem {
        item: IExecutionConfig;
    }

    const choices: IRunConfigQuickPick[] = [];
    choices.push({
        label: 'Built-in Configuration',
        detail: JSON.stringify(__BUILTIN_CONFIG__),
        item: __BUILTIN_CONFIG__,
    });
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
    const showHint: boolean | undefined = workspaceConfiguration.get<boolean>(HINT_FOR_DEFAULT_CONFIG_SETTING_KEY);
    if (!showHint) {
        return;
    }
    const choice: string | undefined = await window.showInformationMessage('Would you like to set this configuration as default?', YES, NO, NEVER_SHOW);
    if (!choice || choice === NO) {
        return;
    } else if (choice === NEVER_SHOW) {
        workspaceConfiguration.update(HINT_FOR_DEFAULT_CONFIG_SETTING_KEY, false, true /* global setting */);
        return;
    }
    if (selectedConfig.name) {
        workspaceConfiguration.update(DEFAULT_CONFIG_NAME_SETTING_KEY, selectedConfig.name, ConfigurationTarget.WorkspaceFolder);
    } else {
        const randomName: string = `config-${randomSequence()}`;
        selectedConfig.name = randomName;
        workspaceConfiguration.update(DEFAULT_CONFIG_NAME_SETTING_KEY, selectedConfig.name, ConfigurationTarget.WorkspaceFolder);
        workspaceConfiguration.update(CONFIG_SETTING_KEY, configs, ConfigurationTarget.WorkspaceFolder);
    }
}

async function migrate(configPath: string): Promise<void> {
    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(undefined, Uri.file(configPath));
    const configSetting: IExecutionConfig[] | IExecutionConfig = workspaceConfig.get<IExecutionConfig[] | IExecutionConfig>(CONFIG_SETTING_KEY, {});
    let configItems: IExecutionConfig[] = [];
    if (!_.isEmpty(configSetting)) {
        if (_.isArray(configSetting)) {
            configItems.push(...configSetting);
        } else if (_.isPlainObject(configSetting)) {
            configItems.push(configSetting);
        }
    }

    const deprecatedConfig: ITestConfig = await fse.readJSON(configPath);
    if (deprecatedConfig.debug && deprecatedConfig.debug.items) {
        for (const item of deprecatedConfig.debug.items) {
            configItems.push(_.omit(item, ['name', 'projectName', 'preLaunchTask']));
        }
    }
    if (deprecatedConfig.run && deprecatedConfig.run.items) {
        for (const item of deprecatedConfig.run.items) {
            configItems.push(_.omit(item, ['name', 'projectName', 'preLaunchTask']));
        }
    }
    configItems = _.uniqWith(configItems, _.isEqual);
    workspaceConfig.update(CONFIG_SETTING_KEY, configItems, ConfigurationTarget.WorkspaceFolder);
}

function randomSequence(): string {
    return crypto.randomBytes(3).toString('hex');
}
