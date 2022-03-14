// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands } from 'vscode';
import { sendError } from 'vscode-extension-telemetry-wrapper';
import { JavaLanguageServerCommands } from '../constants';

export async function executeJavaLanguageServerCommand<T>(...rest: any[]): Promise<T | undefined> {
    try {
        return await commands.executeCommand<T>(JavaLanguageServerCommands.EXECUTE_WORKSPACE_COMMAND, ...rest);
    } catch (error) {
        if (isCancelledError(error)) {
            return;
        }
        sendError(error);
        throw error;
    }
}

function isCancelledError(error: any): boolean {
    // See: https://microsoft.github.io/language-server-protocol/specifications/specification-current/#responseMessage
    return error.code === -32800;
}
