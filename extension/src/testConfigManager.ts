// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import { window, workspace, ExtensionContext, TextEditor } from 'vscode';

import { ProjectInfo, ProjectManager } from './projectManager';
import * as Configs from './Constants/configs';
import { TestConfig } from './Models/testConfig';
import * as Logger from './Utils/Logger/logger';

export class TestConfigManager {
    private readonly _configPath: string;
    constructor(context: ExtensionContext, private _projectManager: ProjectManager) {
        this._configPath = context.asAbsolutePath(Configs.TEST_LAUNCH_CONFIG_NAME);
    }

    public get configPath(): string {
        return this._configPath;
    }

    public loadConfig(): Promise<TestConfig> {
        return new Promise((resolve, reject) => {
            fs.access(this._configPath, (err) => {
                if (err) {
                    const config: TestConfig = this.createDefaultTestConfig();
                    const content: string = JSON.stringify(config, null, 4);
                    fs.writeFile(this._configPath, content, 'utf-8', (writeErr) => {
                        if (writeErr) {
                            Logger.error('Failed to create default test config!', {
                                error: writeErr,
                            });
                            reject(writeErr);
                        }
                        resolve(config);
                    });
                } else {
                    fs.readFile(this._configPath, 'utf-8', (readErr, data) => {
                        if (readErr) {
                            Logger.error('Failed to load test config!', {
                                error: readErr,
                            });
                            reject(readErr);
                        }
                        resolve(JSON.parse(data) as TestConfig);
                    });
                }
            });
        });
    }

    public editConfig(): Promise<TextEditor> {
        const editor = window.activeTextEditor;
        return this.loadConfig().then(() => {
            return workspace.openTextDocument(this._configPath).then((doc) => {
                return window.showTextDocument(doc, editor.viewColumn);
            }, (err) => {
                Logger.error(err);
                return Promise.reject(err);
            });
        });
    }

    private createDefaultTestConfig(): TestConfig {
        const projects: ProjectInfo[] = this._projectManager.getAll();
        const config: TestConfig = {
            run: projects.map((i) => {
                return {
                    name: i.name,
                    projectName: i.name,
                    workingDirectory: workspace.getWorkspaceFolder(i.path).uri.fsPath,
                    args: [],
                    vmargs: [],
                    preLaunchTask: '',
                };
            }),
            debug: projects.map((i) => {
                return {
                    name: i.name,
                    projectName: i.name,
                    workingDirectory: workspace.getWorkspaceFolder(i.path).uri.fsPath,
                    args: [],
                    vmargs: [],
                    preLaunchTask: '',
                };
            }),
        };
        return config;
    }
}
