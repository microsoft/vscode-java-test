// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, ExtensionContext, QuickPickItem, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import * as protocolConverter from 'vscode-languageclient/lib/protocolConverter';
import * as commandUtils from '../utils/commandUtils';

const converter: protocolConverter.Converter = protocolConverter.createConverter();
export async function generateTests(uri: Uri, cursorOffset: number): Promise<void> {
    const edit: WorkspaceEdit = converter.asWorkspaceEdit(await commandUtils.generateTests(uri, cursorOffset));
    if (edit) {
        workspace.applyEdit(edit);
    }
}

export async function registerSelectTestFrameworkCommand(context: ExtensionContext): Promise<void> {
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

interface IOption extends QuickPickItem {
    value: string;
}
