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
        const parsedError: Error = new Error(`Failed to execute: ${rest[0]}, ${extractErrorMsg(error)}.`);
        sendError(parsedError);
        throw error;
    }
}

function isCancelledError(error: any): boolean {
    // See: https://microsoft.github.io/language-server-protocol/specifications/specification-current/#responseMessage
    return error.code === -32800;
}

function extractErrorMsg(e: Error): string {
    let msg: string = e.toString();
    msg = msg.replace(/path must include project and resource name: \/.*/gi, 'Path must include project and resource name: /<REDACT>')
    return msg;
}
