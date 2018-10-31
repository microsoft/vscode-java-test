// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { IProjectInfo, ITestItem } from './protocols';
import { IExecutionConfigGroup, ITestConfig } from './runConfigs';
import { getProjectInfo } from './utils/commandUtils';

class TestConfigManager {
    private readonly configRelativePath: string;
    constructor() {
        this.configRelativePath = path.join('.vscode', 'launch.test.json');
    }
    public get configPath(): string {
        return this.configRelativePath;
    }

    public async loadRunConfig(tests: ITestItem[], isDebug: boolean): Promise<IExecutionConfigGroup[]> {
        const folderSet: Set<WorkspaceFolder> = this.getFoldersOfTests(tests);
        const configs: ITestConfig[] = [];
        for (const folder of folderSet.values()) {
            const configFullPath: string = await this.createTestConfigIfNotExisted(folder);
            const content: string = await fse.readFile(configFullPath, 'utf-8');
            configs.push(JSON.parse(content) as ITestConfig);
        }
        if (isDebug) {
            return configs.map((c: ITestConfig) => c.debug);
        }
        return configs.map((c: ITestConfig) => c.run);
    }

    private async createTestConfigIfNotExisted(folder: WorkspaceFolder): Promise<string> {
        const configFullPath: string = path.join(folder.uri.fsPath, this.configRelativePath);
        if (!await fse.pathExists(configFullPath)) {
            await fse.ensureDir(path.dirname(configFullPath));
            const config: ITestConfig = await this.createDefaultTestConfig(folder.uri);
            await fse.writeFile(configFullPath, JSON.stringify(config, null, 4 /* space size */));
        }
        return configFullPath;
    }

    private async createDefaultTestConfig(folderUri: Uri): Promise<ITestConfig> {
        const projects: IProjectInfo[] = await getProjectInfo(folderUri);
        return {
            run: {
                default: '',
                items: projects.map((project: IProjectInfo) => {
                    return {
                        name: project.name,
                        projectName: project.name,
                        workingDirectory: project.path.fsPath,
                        args: [],
                        vmargs: [],
                        env: {},
                        preLaunchTask: '',
                    };
                }),
            },
            debug: {
                default: '',
                items: projects.map((project: IProjectInfo) => {
                    return {
                        name: project.name,
                        projectName: project.name,
                        workingDirectory: project.path.fsPath,
                        args: [],
                        vmargs: [],
                        env: {},
                        preLaunchTask: '',
                    };
                }),
            },
        };
    }

    private getFoldersOfTests(tests: ITestItem[]): Set<WorkspaceFolder> {
        const workspaceFolderSet: Set<WorkspaceFolder> = new Set<WorkspaceFolder>();
        for (const test of tests) {
            const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(Uri.parse(test.uri));
            if (workspaceFolder) {
                workspaceFolderSet.add(workspaceFolder);
            }
        }
        return workspaceFolderSet;
    }
}

export const testConfigManager: TestConfigManager = new TestConfigManager();
