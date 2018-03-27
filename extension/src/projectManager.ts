// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Commands from './Constants/commands';
import * as Logger from './Utils/Logger/logger';

import { workspace, CancellationToken, Uri } from 'vscode';

export class ProjectManager {
    private projectInfos: ProjectInfo[] = [];

    public async refresh(token?: CancellationToken): Promise<void[]> {
        return Promise.all(workspace.workspaceFolders.map((wkspace) => {
            return getProjectInfo(wkspace.uri).then((infos: ProjectInfo[]) => {
                this.storeProjects(infos.map((i) => { i.path = Uri.parse(i.path.toString()); return i; }));
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
        return this.projectInfos.map((i) => i);
    }

    public getProjectName(file: Uri): string {
        const path: string = this.formatPath(file.fsPath);
        const matched = this.projectInfos.filter((p) => path.startsWith(this.formatPath(p.path.fsPath)));
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

    private formatPath(path: string): string {
        if (!path) {
            return path;
        }
        let formatted = path.toLowerCase().replace(/\\/g, '/');
        if (!formatted.endsWith('/')) {
            formatted += '/';
        }
        return formatted;
    }
}

export type ProjectInfo = {
    path: Uri;
    name: string;
};

function getProjectInfo(folder: Uri) {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_GET_PROJECT_INFO, folder.toString());
}
