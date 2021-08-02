// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Disposable, ExtensionContext, QuickInputButton, QuickPick, QuickPickItem, TextEdit, ThemeIcon, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import * as protocolConverter from 'vscode-languageclient/lib/protocolConverter';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

const converter: protocolConverter.Converter = protocolConverter.createConverter();
export async function generateTests(uri: Uri, cursorOffset: number): Promise<void> {
    const edit: WorkspaceEdit = converter.asWorkspaceEdit(await askServerToGenerateTests(uri, cursorOffset));
    if (edit) {
        await workspace.applyEdit(edit);
        const entries: Array<[Uri, TextEdit[]]> = edit.entries();
        if (entries?.[0]?.[0]) {
            await window.showTextDocument(entries[0][0], {
                preserveFocus: true,
            });
        }
    }
}

export async function registerAskForChoiceCommand(context: ExtensionContext): Promise<void> {
    context.subscriptions.push(commands.registerCommand('_java.test.askClientForChoice', async (placeHolder: string, choices: IOption[], canPickMany: boolean) => {
        const ans: any = await window.showQuickPick(choices, {
            placeHolder,
            canPickMany,
            ignoreFocusOut: true,
        });

        if (!ans) {
            return undefined;
        } else if (Array.isArray(ans)) {
            return ans.map((a: IOption) => a.value || a.label);
        }

        return ans.value || ans.label;
    }));
}

export async function registerAdvanceAskForChoice(context: ExtensionContext): Promise<void> {
    context.subscriptions.push(commands.registerCommand('_java.test.advancedAskClientForChoice', async (placeHolder: string, choices: IOption[], advancedAction: string, canPickMany: boolean) => {
        let result: string[] | undefined;
        const disposables: Disposable[] = [];
        try {
            result = await new Promise<string[] | undefined>((resolve: (value: string[] | undefined) => void) => {
                const quickPick: QuickPick<IOption> = window.createQuickPick<IOption>();
                // if all the items are advanced item, show them directly
                let showAdvancedItem: boolean = choices.filter((c: IOption) => {
                    return !c.isAdvanced;
                }).length === 0;
                quickPick.title = placeHolder;
                quickPick.placeholder = placeHolder;
                quickPick.items = filterOptions(showAdvancedItem, choices);
                quickPick.buttons = getActionButtons(showAdvancedItem, advancedAction);
                quickPick.canSelectMany = canPickMany;
                quickPick.ignoreFocusOut = true;
                disposables.push(quickPick.onDidTriggerButton((btn: QuickInputButton) => {
                    if (btn.tooltip?.endsWith(advancedAction)) {
                        showAdvancedItem = !showAdvancedItem;
                        quickPick.items = filterOptions(showAdvancedItem, choices);
                        quickPick.buttons = getActionButtons(showAdvancedItem, advancedAction);
                    }
                }));
                disposables.push(quickPick.onDidHide(() => {
                    return resolve(undefined);
                }));
                disposables.push(quickPick.onDidAccept(() => {
                    return resolve(quickPick.selectedItems.map((o: IOption) => o.value));
                }));
                disposables.push(quickPick);
                quickPick.show();
            });
        } finally {
            for (const d of disposables) {
                d.dispose();
            }
        }
        return result;
    }));

    function filterOptions(showAdvancedItem: boolean, choices: IOption[]): IOption[] {
        return choices.filter((c: IOption) => {
            return !c.isAdvanced || showAdvancedItem && c.isAdvanced;
        });
    }

    function getActionButtons(showAdvancedItem: boolean, advancedAction: string): QuickInputButton[] {
        if (showAdvancedItem) {
            return [{
                iconPath: new ThemeIcon('collapse-all'),
                tooltip: `Hide ${advancedAction}`,
            }];
        }

        return [{
            iconPath: new ThemeIcon('expand-all'),
            tooltip: `Show ${advancedAction}`,
        }];
    }
}

/**
 * A command that server side can call to get a input value.
 * Currently it's only used to get a Java qualified name, so the check is on the client side.
 * @param context
 */
export async function registerAskForInputCommand(context: ExtensionContext): Promise<void> {
    context.subscriptions.push(commands.registerCommand('_java.test.askClientForInput', async (prompt: string, value: string) => {
        const ans: string | undefined = await window.showInputBox({
            value,
            prompt,
            validateInput: checkJavaQualifiedName,
        });
        return ans;
    }));
}

async function askServerToGenerateTests(uri: Uri, cursorOffset: number): Promise<any> {
    return await executeJavaLanguageServerCommand<any>(JavaTestRunnerDelegateCommands.GENERATE_TESTS, uri.toString(), cursorOffset);
}

function checkJavaQualifiedName(value: string): string {
    if (!value || !value.trim()) {
        return 'Input cannot be empty.';
    }

    for (const part of value.split('.')) {
        if (isKeyword(part)) {
            return `Keyword '${part}' cannot be used.`;
        }

        if (!isJavaIdentifier(part)) {
            return `Invalid Java qualified name.`;
        }
    }

    return '';
}

// Copied from https://docs.oracle.com/javase/specs/jls/se8/html/jls-3.html#jls-Keyword
const keywords: Set<string> = new Set([
    'abstract', 'continue', 'for',        'new',       'switch',
    'assert',   'default',  'if',         'package',   'synchronized',
    'boolean',  'do',       'goto',       'private',   'this',
    'break',    'double',   'implements', 'protected', 'throw',
    'byte',     'else',     'import',     'public',    'throws',
    'case',     'enum',     'instanceof', 'return',    'transient',
    'catch',    'extends',  'int',        'short',     'try',
    'char',     'final',    'interface',  'static',    'void',
    'class',    'finally',  'long',       'strictfp',  'volatile',
    'const',    'float',    'native',     'super',     'while',
]);
export function isKeyword(identifier: string): boolean {
    return keywords.has(identifier);
}

const identifierRegExp: RegExp = /^([a-zA-Z_$][a-zA-Z\d_$]*)$/;
export function isJavaIdentifier(identifier: string): boolean {
    return identifierRegExp.test(identifier);
}

interface IOption extends QuickPickItem {
    value: string;
    isAdvanced?: boolean;
}
