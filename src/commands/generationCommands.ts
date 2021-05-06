// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, ExtensionContext, QuickPickItem, TextEdit, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import * as protocolConverter from 'vscode-languageclient/lib/protocolConverter';
import * as commandUtils from '../utils/commandUtils';

const converter: protocolConverter.Converter = protocolConverter.createConverter();
export async function generateTests(uri: Uri, cursorOffset: number): Promise<void> {
    const edit: WorkspaceEdit = converter.asWorkspaceEdit(await commandUtils.generateTests(uri, cursorOffset));
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
        const options: IOption[] = [];
        for (const c of choices) {
            options.push({
                label: c.label,
                description: c.description,
                value: c.value,
            });
        }
        const ans: any = await window.showQuickPick(options, {
            placeHolder,
            canPickMany,
        });

        if (!ans) {
            return undefined;
        } else if (Array.isArray(ans)) {
            return ans.map((a: IOption) => a.value || a.label);
        }

        return ans.value || ans.label;
    }));
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

const keywords: Set<string> = new Set([
    'abstract', 'default', 'if', 'private', 'this', 'boolean', 'do', 'implements', 'protected', 'throw', 'break', 'double', 'import',
    'public', 'throws', 'byte', 'else', 'instanceof', 'return', 'transient', 'case', 'extends', 'int', 'short', 'try', 'catch', 'final',
    'interface', 'static', 'void', 'char', 'finally', 'long', 'strictfp', 'volatile', 'class', 'float', 'native', 'super', 'while',
    'const', 'for', 'new', 'switch', 'continue', 'goto', 'package', 'synchronized', 'true', 'false', 'null', 'assert', 'enum',
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
}
