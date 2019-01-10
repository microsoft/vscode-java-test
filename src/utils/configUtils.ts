// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { logger } from '../logger/logger';

export function resolveWorkingDirectory(testUriString: string, cwd: string | undefined): string | undefined {
    if (cwd && /\$\{workspacefolder\}/i.test(cwd.trim())) {
        const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(testUriString));
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
        logger.error(`Failed to parse the working directory for test: ${testUriString}`);
        return undefined;
    }
    return cwd;
}
