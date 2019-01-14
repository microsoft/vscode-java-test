// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as crypto from 'crypto';
import * as fse from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import { commands, ConfigurationTarget, QuickPickItem, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { BUILTIN_CONFIG_NAME, CONFIG_DOCUMENT_URL, CONFIG_SETTING_KEY, DEFAULT_CONFIG_NAME_SETTING_KEY, HINT_FOR_DEFAULT_CONFIG_SETTING_KEY,
    HINT_FOR_DEPRECATED_CONFIG_SETTING_KEY } from './constants/configs';
import { LEARN_MORE, NEVER_SHOW, NO, YES } from './constants/dialogOptions';
import { ITestItem } from './protocols';
import { __BUILTIN_CONFIG__, IExecutionConfig, IExecutionConfigGroup, ITestConfig } from './runConfigs';

class TestConfigManager {
    private readonly configRelativePath: string;
    constructor() {
        this.configRelativePath = path.join('.vscode', 'launch.test.json');
    }
    public get configPath(): string {
        return this.configRelativePath;
    }

    // The test items that belong to a test runner, here the test items should be in the same workspace folder.
    public async loadRunConfig(tests: ITestItem[], isDebug: boolean): Promise<IExecutionConfig | undefined> {
        const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(tests[0].uri));
        if (!workspaceFolder) {
            return undefined;
        }

        const configSetting: IExecutionConfig[] | IExecutionConfig = workspace.getConfiguration(undefined, workspaceFolder.uri).get<IExecutionConfig[] | IExecutionConfig>(CONFIG_SETTING_KEY, {});
        if (!_.isEmpty(configSetting)) {
            // Use the new config schema
            const configItems: IExecutionConfig[] = [];
            if (_.isPlainObject(configSetting)) {
                configItems.push(configSetting as IExecutionConfig);
            } else if (_.isArray(configSetting)) {
                configItems.push(...configSetting);
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
                    window.showWarningMessage(`Failed to find the default configuration item: ${defaultConfigName}, tests will be launched with built-in configurations.`);
                    return __BUILTIN_CONFIG__;
                } else if (defaultConfigs.length > 1) {
                    window.showWarningMessage(`More than one configuration item found with name: ${defaultConfigName}, tests will be launched with built-in configurations.`);
                    return __BUILTIN_CONFIG__;
                } else {
                    return defaultConfigs[0];
                }
            }
            return await this.selectQuickPick(configItems, workspaceFolder.uri);
        } else {
            // Using deprecated config shcema
            const deprecatedConfigs: IExecutionConfigGroup[] = [];
            const configFullPath: string = path.join(workspaceFolder.uri.fsPath, this.configRelativePath);
            if (!await fse.pathExists(configFullPath)) {
                return __BUILTIN_CONFIG__;
            }
            this.hintForDeprecatedUsage();
            const content: string = await fse.readFile(configFullPath, 'utf-8');
            const deprecatedConfig: ITestConfig = JSON.parse(content);
            deprecatedConfigs.push(isDebug ? deprecatedConfig.debug : deprecatedConfig.run);
            return await this.selectDeprecatedConfig(deprecatedConfigs);
        }
    }

    private async selectDeprecatedConfig(configs: IExecutionConfigGroup[]): Promise<IExecutionConfig | undefined> {
        if (configs.length === 0) {
            return undefined;
        }
        if (configs[0].default) {
            const runConfig: IExecutionConfigGroup = configs[0];
            const candidates: IExecutionConfig[] = runConfig.items.filter((item: IExecutionConfig) => item.name === runConfig.default);
            if (candidates.length === 0) {
                window.showWarningMessage(`There is no config with name: ${runConfig.default}.`);
                return undefined;
            }
            if (candidates.length > 1) {
                window.showWarningMessage(`Duplicate configs with default name: ${runConfig.default}.`);
                return undefined;
            }
            return candidates[0];
        }

        if (configs.length > 1) {
            window.showWarningMessage('It is not supported to run tests with config from multi root.');
            return undefined;
        }

        const configItems: IExecutionConfig[] = [];
        for (const config of configs) {
            configItems.push(...config.items);
        }
        return this.selectQuickPick(configItems);
    }

    private async selectQuickPick(configs: IExecutionConfig[], workspaceFolderUri?: Uri): Promise<IExecutionConfig | undefined> {
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
        const selection: IRunConfigQuickPick | undefined = await window.showQuickPick(choices, { ignoreFocusOut: true, placeHolder: 'Select test configuration' });
        if (!selection) {
            window.showWarningMessage('No configuration item is picked, tests will be launched with built-in configurations.');
            return __BUILTIN_CONFIG__;
        }
        if (workspaceFolderUri) {
            this.askPreferenceForConfig(configs, selection.item, workspaceFolderUri);
        }

        return selection.item;
    }

    private async hintForDeprecatedUsage(): Promise<void> {
        sendInfo('', { deprecatedConfigUsed: '1' });
        const workspaceConfiguration: WorkspaceConfiguration = workspace.getConfiguration();
        const showHint: boolean | undefined = workspaceConfiguration.get<boolean>(HINT_FOR_DEPRECATED_CONFIG_SETTING_KEY);
        if (!showHint) {
            return;
        }
        const choice: string | undefined = await window.showInformationMessage(
            'Using launch.test.json to run tests is deprecated, please use the "java.test.config" setting instead',
            NEVER_SHOW,
            LEARN_MORE,
        );
        if (choice === NEVER_SHOW) {
            workspaceConfiguration.update(HINT_FOR_DEPRECATED_CONFIG_SETTING_KEY, false, true /* global setting */);
        } else if (choice === LEARN_MORE) {
            commands.executeCommand('vscode.open', Uri.parse(CONFIG_DOCUMENT_URL));
        }
    }

    private async askPreferenceForConfig(configs: IExecutionConfig[], selectedConfig: IExecutionConfig, workspaceFolderUri: Uri): Promise<void> {
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
            const randomName: string = `config-${crypto.randomBytes(3).toString('hex')}`;
            selectedConfig.name = randomName;
            workspaceConfiguration.update(DEFAULT_CONFIG_NAME_SETTING_KEY, selectedConfig.name, ConfigurationTarget.WorkspaceFolder);
            workspaceConfiguration.update(CONFIG_SETTING_KEY, configs, ConfigurationTarget.WorkspaceFolder);
        }
    }
}

export const testConfigManager: TestConfigManager = new TestConfigManager();
