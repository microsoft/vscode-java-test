// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as crypto from 'crypto';
import * as _ from 'lodash';
import { ConfigurationTarget, QuickPickItem, TestItem, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { Configurations, Dialog } from '../constants';
import { dataCache } from '../controller/testItemDataCache';
import { extensionContext } from '../extension';
import { getBuiltinConfig, IExecutionConfig } from '../runConfigs';

export async function loadRunConfig(testItems: TestItem[], workspaceFolder: WorkspaceFolder): Promise<IExecutionConfig | undefined> {
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

    const candidateConfigItems: IExecutionConfig[] = filterCandidateConfigItems(configItems, testItems);
    return await selectQuickPick(candidateConfigItems, workspaceFolder);
}

function filterCandidateConfigItems(configItems: IExecutionConfig[], testItems: TestItem[]): IExecutionConfig[] {
    return configItems.filter((config: IExecutionConfig) => {
        const whenClause: string | undefined = config.when?.trim();

        if (whenClause) {
            const context: WhenClauseEvaluationContext = new WhenClauseEvaluationContext(whenClause);

            try {
                return checkTestItems(testItems, context);
            } catch (e) {
                // do something with the error
            }
        }

        return true;

    });
}

function checkTestItems(testItems: TestItem[], context: WhenClauseEvaluationContext): boolean {
    return testItems.every((testItem: TestItem) => {
        const fullName: string | undefined = dataCache.get(testItem)?.fullName;

        context.addContextKey('testItem', fullName);
        return context.evaluate();
    });
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

type ApplyOperator = (value1: unknown, value2?: unknown) => boolean

interface Token {
    stringValue: string
    getValue: () => unknown
}

export class WhenClauseEvaluationContext {

    private static readonly OPERATORS: Record<string, ApplyOperator> = {
        // logical
        '!': (value: unknown) => !value,
        '&&': (value1: unknown, value2: unknown) => !!(value1 && value2),
        '||': (value1: unknown, value2: unknown) => !!(value1 || value2),

        // equality
        '==': (value1: unknown, value2: unknown) => value1 === value2,
        '===': (value1: unknown, value2: unknown) => value1 === value2,
        '!=': (value1: unknown, value2: unknown) => value1 !== value2,
        '!==': (value1: unknown, value2: unknown) => value1 !== value2,

        // comparison
        '>': (value1: number, value2: number) => value1 > value2,
        '>=': (value1: number, value2: number) => value1 >= value2,
        '<': (value1: number, value2: number) => value1 < value2,
        '<=': (value1: number, value2: number) => value1 <= value2,

        // match
        '=~': (value: string, pattern: RegExp) => pattern.test(value),
    }

    private readonly context: Record<string, unknown> = {};

    public constructor(readonly clause: string) {}

    private tokenize(): Token[] {
        const operatorKeys: string[] = Object.keys(WhenClauseEvaluationContext.OPERATORS).sort((a: string, b: string) => b.length - a.length);
        const operatorPattern: RegExp = new RegExp(`(${operatorKeys.map(_.escapeRegExp).join('|')})`);

        const tokens: string[] = this.clause.split(operatorPattern)
            .flatMap((token: string) => token.trim().split(/([()])/))
            .filter(Boolean);

        return tokens.map((token: string) => ({
            stringValue: token,
            getValue: () => this.parse(token),
        }));
    }

    private parse(token: string) {
        const quotedStringMatch: RegExpMatchArray | null = token.match(/['"](.*)['"]/);
        if (quotedStringMatch)
            return quotedStringMatch[1];

        const regexMatch: RegExpMatchArray | null = token.match(/\/(?<pattern>.*)\/(?<flags>[ismu]*)/)
        if (regexMatch?.groups) {
            const { pattern, flags } = regexMatch.groups;
            return new RegExp(pattern, flags);
        }

        const number: number = Number(token);
        if (!isNaN(number))
            return number;

        const booleanMatch: RegExpMatchArray | null = token.match(/^(?:true|false)$/);
        if (booleanMatch)
            return booleanMatch[0] === 'true';

        if (token === typeof undefined)
            return;

        if (!(token in this.context))
            throw new SyntaxError(`Context key not found in evaluation context: ${token}`);

        return this.context[token];
    }

    private evaluateTokens(tokens: Token[], start?: number, end?: number) {
        start ||= 0;
        end ||= tokens.length;

        const currentTokens: Token[] = tokens.slice(start, end);

        while (currentTokens.length > 1) {
            const stringTokens: string[] = currentTokens.map((token: Token) => token.stringValue);

            const parenthesesStart: number = stringTokens.lastIndexOf('(');
            const parenthesesEnd: number = (() => {
                const relativeEnd: number = stringTokens.slice(parenthesesStart).indexOf(')');
                return relativeEnd >= 0 ? parenthesesStart + relativeEnd : -1;
            })();

            if (parenthesesEnd < parenthesesStart)
                throw new SyntaxError('Mismatched parentheses in expression');

            if (parenthesesEnd > parenthesesStart) {
                const resultToken: Token = this.evaluateTokens(currentTokens, parenthesesStart + 1, parenthesesEnd);
                currentTokens.splice(parenthesesStart, parenthesesEnd - parenthesesStart + 1, resultToken);

                continue;
            }

            for (const [operator, applyOperator] of Object.entries(WhenClauseEvaluationContext.OPERATORS)) {
                const operatorIndex: number = currentTokens.findIndex((token: Token) => token.stringValue === operator);

                if (operatorIndex === -1)
                    continue;

                const leftOperand: Token = currentTokens[operatorIndex - 1];
                const rightOperand: Token = currentTokens[operatorIndex + 1];

                const value: boolean = applyOperator.length === 1
                    ? applyOperator(rightOperand.getValue())
                    : applyOperator(leftOperand.getValue(), rightOperand.getValue());

                const operationStart: number = operatorIndex - (applyOperator.length - 1);
                const operationLength: number = applyOperator.length + 1;

                currentTokens.splice(operationStart, operationLength, {
                    stringValue: value.toString(),
                    getValue: () => value,
                });

                break;
            }
        }

        return currentTokens[0];
    }

    addContextKey(key: string, value: unknown): void {
        this.context[key] = value;
    }

    evaluate(): boolean {
        const tokens: Token[] = this.tokenize();
        const result: Token = this.evaluateTokens(tokens);

        return !!result.getValue();
    }

}
