// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { workspace, CancellationToken, Uri } from 'vscode';
import { ProjectManager } from './projectManager';
import * as Commands from './Constants/commands';
import * as Logger from './Utils/Logger/logger';

export class ClassPathManager {
    // mapping from project folder uri to classpaths.
    private _classPathCache = new Map<Uri, string[]>();
    constructor(private readonly _projectManager: ProjectManager) {
    }

    public async refresh(token?: CancellationToken): Promise<void[]> {
        if (!workspace.workspaceFolders) {
            return;
        }
        await this._projectManager.refresh();
        return Promise.all(this._projectManager.getAll().map((info) => {
            return calculateClassPath(info.path).then((classpath: string[]) => this.storeClassPath(info.path, classpath),
            (reason) => {
                if (token && token.isCancellationRequested) {
                    return;
                }
                Logger.error(`Failed to refresh class path. Details: ${reason}.`);
                return Promise.reject(reason);
            });
        }));
    }

    public dispose() {
        this._classPathCache.clear();
    }

    public getClassPath(resource: Uri): string[] | undefined {
        const path = this._projectManager.getProjectPath(resource);
        return this._classPathCache.has(path) ? this._classPathCache.get(path) : undefined;
    }

    public getClassPaths(resources: Uri[]): string[] | undefined {
        const set = new Set(resources.map((r) => this._projectManager.getProjectPath(r)).filter((p) => p && this._classPathCache.has(p)));
        return [...set].map((p) => this._classPathCache.get(p)).reduce((a, b) => a.concat(b), []);
    }

    public storeClassPath(resource: Uri, classPath: string[]): void {
        const path = this._projectManager.getProjectPath(resource);
        this._classPathCache.set(path, classPath);
    }
}

function calculateClassPath(folder: Uri) {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_CALCULATE_CLASS_PATH, folder.toString());
}
