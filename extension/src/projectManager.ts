// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Commands from './Constants/commands';
import * as Logger from './Utils/Logger/logger';

import * as path from 'path';
import { workspace, CancellationToken, Uri } from 'vscode';

export class ProjectManager {
    private projectInfos: ProjectInfo[] = [];

    public async refresh(token?: CancellationToken): Promise<void[]> {
        if (!workspace.workspaceFolders) {
            return;
        }
        return Promise.all(workspace.workspaceFolders.map((wkspace) => {
            return this.getProjectInfo(wkspace.uri).then((infos: ProjectInfo[]) => {
                infos.forEach((i) => { i.path = Uri.parse(i.path.toString()); });
                this.storeProjects(infos);
            },
            (reason) => {
                if (token.isCancellationRequested) {
                    return;
                }
                Logger.error(`Failed to refresh project mapping. Details: ${reason}.`);
                return Promise.reject(reason);
            });
        }));
    }

    public storeProjects(infos: ProjectInfo[]): void {
        this.projectInfos = this.projectInfos.concat(infos);
    }

    public getAll(): ProjectInfo[] {
        return this.projectInfos.map((i) => ({...i}));
    }

    public getProjectName(file: Uri): string {
        const fpath: string = this.formatPath(file.fsPath);
        const matched = this.projectInfos.filter((p) => fpath.startsWith(this.formatPath(p.path.fsPath)));
        if (matched.length === 0) {
            Logger.error(`Failed to get project name for file ${file}.`);
            return undefined;
        }
        if (matched.length > 1) {
            Logger.error(`Found multiple projects for file ${file}: ${matched}`);
            return undefined;
        }
        return matched[0].name;
    }

    private formatPath(p: string): string {
        if (!p) {
            return p;
        }
        let formatted = path.normalize(p).toLowerCase().replace(/\\/g, '/');
        if (!formatted.endsWith('/')) {
            formatted += '/';
        }
        return formatted;
    }

    private getProjectInfo(folder: Uri) {
        return Commands.executeJavaLanguageServerCommand(Commands.JAVA_GET_PROJECT_INFO, folder.toString());
    }
}

export type ProjectInfo = {
    path: Uri;
    name: string;
};
