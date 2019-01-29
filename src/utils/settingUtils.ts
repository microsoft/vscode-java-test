// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri, ViewColumn, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { DEFAULT_LOG_LEVEL, DEFAULT_REPORT_POSITION, LOG_LEVEL_SETTING_KEY, REPORT_POSITION_SETTING_KEY } from '../constants/configs';
import { logger } from '../logger/logger';

export function getReportPosition(): ViewColumn {
    const config: WorkspaceConfiguration = workspace.getConfiguration();
    const position: string = config.get<string>(REPORT_POSITION_SETTING_KEY, DEFAULT_REPORT_POSITION);
    return position === DEFAULT_REPORT_POSITION ? ViewColumn.Two : ViewColumn.Active;
}

export function getLogLevel(): string {
    return workspace.getConfiguration().get<string>(LOG_LEVEL_SETTING_KEY, DEFAULT_LOG_LEVEL);
}

const workspaceRegexp: RegExp = /\$\{workspacefolder\}/i;
export function resolveWorkingDirectory(testUriString: string, cwd: string | undefined): string | undefined {
    if (cwd && workspaceRegexp.test(cwd)) {
        const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(testUriString));
        if (workspaceFolder) {
            return cwd.replace(workspaceRegexp, workspaceFolder.uri.fsPath);
        }
        logger.error(`Failed to parse the working directory for test: ${testUriString}`);
        return undefined;
    }
    return cwd;
}
