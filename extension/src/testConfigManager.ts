// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import { window, workspace, ExtensionContext, TextEditor } from 'vscode';

import { ProjectInfo, ProjectManager } from './projectManager';
import * as Configs from './Constants/configs';
import { TestConfig } from './Models/testConfig';
import * as Logger from './Utils/Logger/logger';

export class TestConfigManager {
    private readonly _configPath: string;
    constructor(private readonly _projectManager: ProjectManager) {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('Not supported without a folder!');
        }
        this._configPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', Configs.TEST_LAUNCH_CONFIG_NAME);
    }

    public get configPath(): string {
        return this._configPath;
    }

    public async loadConfig(): Promise<TestConfig> {
        await this.createTestConfigIfNotExisted();
        return new Promise<TestConfig>((resolve, reject) => {
            fs.readFile(this._configPath, 'utf-8', (readErr, data) => {
                if (readErr) {
                    Logger.error('Failed to read the test config!', {
                        error: readErr,
                    });
                    return reject(readErr);
                }
                try {
                    const config: TestConfig = JSON.parse(data) as TestConfig;
                    resolve(config);
                } catch (ex) {
                    Logger.error('Failed to parse the test config!', {
                        error: ex,
                    });
                    reject(ex);
                }
            });
        });
    }

    public editConfig(): Promise<TextEditor> {
        const editor = window.activeTextEditor;
        return this.createTestConfigIfNotExisted().then(() => {
            return workspace.openTextDocument(this._configPath).then((doc) => {
                return window.showTextDocument(doc, editor ? editor.viewColumn : undefined);
            }, (err) => {
                return Promise.reject(err);
            });
        });
    }

    private createTestConfigIfNotExisted(): Promise<void> {
        return new Promise((resolve, reject) => {
            mkdirp(path.dirname(this._configPath), (merr) => {
                if (merr && merr.code !== 'EEXIST') {
                    Logger.error(`Failed to create sub directory for this config. File path: ${this._configPath}`, {
                        error: merr,
                    });
                    return reject(merr);
                }
                fs.access(this._configPath, (err) => {
                    if (err) {
                        const config: TestConfig = this.createDefaultTestConfig();
                        const content: string = JSON.stringify(config, null, 4);
                        fs.writeFile(this._configPath, content, 'utf-8', (writeErr) => {
                            if (writeErr) {
                                Logger.error('Failed to create default test config!', {
                                    error: writeErr,
                                });
                                return reject(writeErr);
                            }
                        });
                    }
                    resolve();
                });
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
