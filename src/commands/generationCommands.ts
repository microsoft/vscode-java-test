// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, ExtensionContext, Uri, window, workspace, WorkspaceEdit } from 'vscode';
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
    context.subscriptions.push(commands.registerCommand('_java.test.askClientForChoice', async (placeHolder: string, choices: string[], canPickMany: boolean) => {
        const choice: string | undefined = await window.showQuickPick(choices, {
            placeHolder,
            canPickMany,
        });
        return choice;
    }));
}
