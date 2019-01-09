// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as path from 'path';
import { commands, MessageItem, QuickPickItem, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { CONFIG_DOCUMENT_URL, HINT_FOR_DEPRECATED_CONFIG_SETTING_KEY } from './constants/configs';
import { ITestItem } from './protocols';
import { IExecutionConfig, IExecutionConfigGroup, ITestConfig } from './runConfigs';

class TestConfigManager {
    private readonly configRelativePath: string;
    constructor() {
        this.configRelativePath = path.join('.vscode', 'launch.test.json');
    }
    public get configPath(): string {
        return this.configRelativePath;
    }

    // The test items that belong to a test runner, here the test items should be in the same workspace folder.
    public async loadRunConfig(tests: ITestItem[], isDebug: boolean, usingDefaultConfig: boolean): Promise<IExecutionConfig | undefined> {
        const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(tests[0].uri));
        if (!workspaceFolder) {
            return undefined;
        }

        const configs: IExecutionConfig[] | undefined = workspace.getConfiguration('java.test', workspaceFolder.uri).get<IExecutionConfig[]>('config');
        if (configs && configs.length > 0) {
            // Use the new config schema
            if (usingDefaultConfig) {
                return configs[0];
            }
            return await this.selectQuickPick(configs);
        } else {
            // Using deprecated config shcema
            const deprecatedConfigs: IExecutionConfigGroup[] = [];
            const configFullPath: string = path.join(workspaceFolder.uri.fsPath, this.configRelativePath);
            if (!await fse.pathExists(configFullPath)) {
                return undefined;
            }
            this.hintForDeprecatedUsage();
            const content: string = await fse.readFile(configFullPath, 'utf-8');
            const deprecatedConfig: ITestConfig = JSON.parse(content);
            deprecatedConfigs.push(isDebug ? deprecatedConfig.debug : deprecatedConfig.run);
            return await this.selectDeprecatedConfig(deprecatedConfigs, usingDefaultConfig);
        }
    }

    private async selectDeprecatedConfig(configs: IExecutionConfigGroup[], usingDefaultConfig: boolean): Promise<IExecutionConfig | undefined> {
        if (configs.length === 0) {
            return undefined;
        }
        if (usingDefaultConfig) {
            if (configs.length !== 1 || !configs[0].default) {
                return undefined;
            }
            const runConfig: IExecutionConfigGroup = configs[0];
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

        if (configs.length > 1) {
            window.showWarningMessage('It is not supported to run tests with config from multi root.');
        }

        const configItems: IExecutionConfig[] = [];
        for (const config of configs) {
            configItems.push(...config.items);
        }
        return this.selectQuickPick(configItems);
    }

    private async selectQuickPick(configs: IExecutionConfig[]): Promise<IExecutionConfig> {
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
        const selection: IRunConfigQuickPick | undefined = await window.showQuickPick(choices, { placeHolder: 'Select test config' });
        if (!selection) {
            throw new Error('Please specify the test config to use.');
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
        const choice: MessageItem | undefined = await window.showInformationMessage(
            'Using launch.test.json to run tests is deprecated, please use the "java.test.config" setting instead',
            DialogOptions.neverShow,
            DialogOptions.learnMore,
        );
        if (choice === DialogOptions.neverShow) {
            workspaceConfiguration.update(HINT_FOR_DEPRECATED_CONFIG_SETTING_KEY, false, true /* global setting */);
        } else if (choice === DialogOptions.learnMore) {
            commands.executeCommand('vscode.open', Uri.parse(CONFIG_DOCUMENT_URL));
        }
    }
}

namespace DialogOptions {
    export const learnMore: MessageItem = { title: 'Learn More' };
    export const neverShow: MessageItem = { title: 'Never Show again' };
}

export const testConfigManager: TestConfigManager = new TestConfigManager();
