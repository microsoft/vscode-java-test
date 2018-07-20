// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Commands from './Constants/commands';
import * as Logger from './Utils/Logger/logger';

import * as path from 'path';
import { workspace, CancellationToken, Uri } from 'vscode';

export class ProjectManager {
    // mapping from workspace folder uri to projects.
    private projectInfos: Map<string, ProjectInfo[]> = new Map<string, ProjectInfo[]>();

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
                if (token && token.isCancellationRequested) {
                    return;
                }
                Logger.error(`Failed to refresh project mapping. Details: ${reason}.`);
                return Promise.reject(reason);
            });
        }));
    }

    public storeProjects(wkspace: Uri, infos: ProjectInfo[]): void {
        this.projectInfos.set(wkspace.fsPath, infos);
    }

    public getProjects(wkspace: Uri): ProjectInfo[] {
        return this.projectInfos.has(wkspace.fsPath) ? this.projectInfos.get(wkspace.fsPath) : [];
    }

    public getAll(): ProjectInfo[] {
        return [...this.projectInfos.values()].reduce((a, b) => a.concat(b), []);
    }

    public getProject(file: Uri): ProjectInfo {
        const fpath: string = this.formatPath(file.fsPath);
        const matched = this.getAll()
                            .filter((p) => fpath.startsWith(this.formatPath(p.path.fsPath)))
                            .sort((a, b) => (a.path.fsPath < b.path.fsPath ? 1 : -1));
        if (matched.length === 0) {
            Logger.error(`Failed to get the project for the file ${file.fsPath}.`);
            return undefined;
        }
        if (matched.length > 1) {
            Logger.warn(`Found multiple projects for the file ${file.fsPath}: ${matched.map((m) => m.name + ':' + m.path.fsPath)}`);
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
