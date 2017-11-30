// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, Uri, workspace } from 'vscode';
import { Commands } from './commands';

export class ClassPathManager {
    private classPathCache = new Map<string, string[]>();

    public async refresh(token?: CancellationToken): Promise<void[]> {
        return Promise.all(workspace.workspaceFolders.map((wkspace) => {
            return calculateClassPath(wkspace.uri).then((classpath: string[]) => {
                this.storeClassPath(wkspace.uri, classpath);
            },
            (reason) => {
                if (token.isCancellationRequested) {
                    return;
                }
                return Promise.reject(reason);
            });
        }));
    }

    public dispose() {
        this.classPathCache.clear();
    }

    public getClassPath(wkspace: Uri): string[] | undefined {
        const path = this.getWorkspaceFolderPath(wkspace) || '';
        return this.classPathCache.has(path) ? this.classPathCache.get(path) : undefined;
    }

    public storeClassPath(wkspace: Uri, classPath: string[]): void {
        const path = this.getWorkspaceFolderPath(wkspace) || '';
        this.classPathCache.set(path, classPath);
    }

    private getWorkspaceFolderPath(resource: Uri): string | undefined {
        const folder = workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.path : undefined;
    }
}

function calculateClassPath(folder: Uri) {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_CALCULATE_CLASS_PATH, folder.toString());
}
