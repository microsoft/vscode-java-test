// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Commands from './Constants/commands';
import * as Logger from './Utils/Logger/logger';

import * as path from 'path';
import { workspace, CancellationToken, Uri } from 'vscode';

export class ProjectManager {
    // mapping from workspace folder uri to projects.
    private projectInfos: Map<Uri, ProjectInfo[]> = new Map<Uri, ProjectInfo[]>();

    public async refresh(token?: CancellationToken): Promise<void[]> {
        if (!workspace.workspaceFolders) {
            return;
        }
        return Promise.all(workspace.workspaceFolders.map((wkspace) => {
            return this.getProjectInfo(wkspace.uri).then((infos: ProjectInfo[]) => {
                infos.forEach((i) => { i.path = Uri.parse(i.path.toString()); });
                this.storeProjects(wkspace.uri, infos);
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

    public storeProjects(wkspace: Uri, infos: ProjectInfo[]): void {
        this.projectInfos.set(wkspace, infos);
    }

    public getProjects(wkspace: Uri): ProjectInfo[] {
        return this.projectInfos.has(wkspace) ? this.projectInfos.get(wkspace) : [];
    }

    public getAll(): ProjectInfo[] {
        return [...this.projectInfos.values()].reduce((a, b) => a.concat(b), []);
    }

    public getProject(file: Uri): ProjectInfo {
        const fpath: string = this.formatPath(file.fsPath);
        const matched = this.getAll().filter((p) => fpath.startsWith(this.formatPath(p.path.fsPath)));
        if (matched.length === 0) {
            Logger.error(`Failed to get project.`);
            return undefined;
        }
        if (matched.length > 1) {
            Logger.error(`Found multiple projects: ${matched.map((m) => m.name)}`);
            return undefined;
        }
        return matched[0];
    }

    public getProjectName(file: Uri): string {
        const project = this.getProject(file);
        return project && project.name;
    }

    public getProjectPath(file: Uri): Uri {
        const project = this.getProject(file);
        return project && project.path;
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
