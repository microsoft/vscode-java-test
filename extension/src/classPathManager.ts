// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { workspace, CancellationToken, Uri } from 'vscode';
import { ProjectManager } from './projectManager';
import * as Commands from './Constants/commands';
import * as Logger from './Utils/Logger/logger';

export class ClassPathManager {
    // mapping from project folder path to classpaths.
    private _classPathCache = new Map<string, string[]>();
    constructor(private readonly _projectManager: ProjectManager) {
    }

    public async refresh(token?: CancellationToken): Promise<void> {
        if (!workspace.workspaceFolders) {
            return;
        }
        await this._projectManager.refresh();
        await Promise.all(this._projectManager.getAll().map(async (info) => {
            try {
                this.storeClassPath(info.path, await calculateClassPath(info.path));
            } catch (error) {
                if (token && token.isCancellationRequested) {
                    return;
                }
                Logger.error(`Failed to refresh class path. Details: ${error}.`);
                throw error;
            }
        }));
    }

    public dispose() {
        this._classPathCache.clear();
    }

    public getClassPath(resource: Uri): string[] | undefined {
        const path = this._projectManager.getProjectPath(resource);
        return this._classPathCache.has(path.fsPath) ? this._classPathCache.get(path.fsPath) : undefined;
    }

    public getClassPaths(resources: Uri[]): string[] | undefined {
        const set = new Set(resources.map((r) => this._projectManager.getProjectPath(r)).filter((p) => p && this._classPathCache.has(p.fsPath)));
        return [...set].map((p) => this._classPathCache.get(p.fsPath)).reduce((a, b) => a.concat(b), []);
    }

    public storeClassPath(resource: Uri, classPath: string[]): void {
        const path = this._projectManager.getProjectPath(resource);
        this._classPathCache.set(path.fsPath, classPath);
    }
}

function calculateClassPath(folder: Uri): Thenable<string[]> {
    return Commands.executeJavaLanguageServerCommand<string[]>(Commands.JAVA_CALCULATE_CLASS_PATH, folder.toString());
}
