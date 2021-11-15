// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TextEdit, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import * as protocolConverter from 'vscode-languageclient/lib/protocolConverter';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

const converter: protocolConverter.Converter = protocolConverter.createConverter();
export async function generateTests(uri: Uri, cursorOffset: number): Promise<void> {
    const edit: WorkspaceEdit = converter.asWorkspaceEdit(await askServerToGenerateTests(uri, cursorOffset));
    if (edit) {
        await workspace.applyEdit(edit);
        const entries: [Uri, TextEdit[]][] = edit.entries();
        if (entries?.[0]?.[0]) {
            await window.showTextDocument(entries[0][0], {
                preserveFocus: true,
            });
        }
    }
}

async function askServerToGenerateTests(uri: Uri, cursorOffset: number): Promise<any> {
    return await executeJavaLanguageServerCommand<any>(JavaTestRunnerDelegateCommands.GENERATE_TESTS, uri.toString(), cursorOffset);
}
