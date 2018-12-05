// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as path from 'path';
import { TextDocument, ViewColumn, window, workspace } from 'vscode';
import { LOG_FILE_NAME } from '../constants/configs';
import { logger } from '../logger/logger';
import { outputChannelTransport } from '../logger/outputChannelTransport';

export async function openLogFile(storagePath: string): Promise<void> {
    const logFilePath: string = path.join(storagePath, LOG_FILE_NAME);
    if (!await fse.pathExists(logFilePath)) {
        const errorMsg: string = 'The log file does not exist.';
        logger.error(errorMsg);
        await window.showErrorMessage(errorMsg);
        return;
    }
    const textDocument: TextDocument = await workspace.openTextDocument(logFilePath);
    window.showTextDocument(textDocument, ViewColumn.Active, false);
}

export function showOutputChannel(): void {
    outputChannelTransport.show();
}
