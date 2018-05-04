// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import { window, workspace, ExtensionContext, TextEditor, Uri, WorkspaceFolder } from 'vscode';

import { ProjectInfo, ProjectManager } from './projectManager';
import * as Configs from './Constants/configs';
import { TestSuite } from './Models/protocols';
import { TestConfig } from './Models/testConfig';
import * as Logger from './Utils/Logger/logger';

export class TestConfigManager {
    private readonly _configPath: string;
    constructor(private readonly _projectManager: ProjectManager) {
        this._configPath = path.join('.vscode', Configs.TEST_LAUNCH_CONFIG_NAME);
    }

    public get configPath(): string {
        return this._configPath;
    }

    public async loadConfig(tests: TestSuite[]): Promise<TestConfig[]> {
        const folders = [...new Set(tests.map((t) => workspace.getWorkspaceFolder(Uri.parse(t.uri))).filter((t) => t))];
        return Promise.all(folders.map((f) => new Promise<TestConfig>(async (resolve, reject) => {
            const fullPath = path.join(f.uri.fsPath, this._configPath);
            await this.createTestConfigIfNotExisted(f);
            fs.readFile(fullPath, 'utf-8', (readErr, data) => {
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
        })));
    }

    public editConfig(): Promise<TextEditor> {
        if (!workspace.workspaceFolders) {
            throw new Error('Not supported without a folder!');
        }
        const editor = window.activeTextEditor;
        let folder = workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) {
            Logger.warn(`Active file isn't within a folder, use first folder instead.`);
            folder = workspace.workspaceFolders[0];
        }
        return this.createTestConfigIfNotExisted(folder).then(() => {
            const fullPath = path.join(folder.uri.fsPath, this._configPath);
            return workspace.openTextDocument(fullPath).then((doc) => {
                return window.showTextDocument(doc, editor ? editor.viewColumn : undefined);
            }, (err) => {
                return Promise.reject(err);
            });
        });
    }

    private createTestConfigIfNotExisted(folder: WorkspaceFolder): Promise<void> {
        return new Promise((resolve, reject) => {
            const configFullPath = path.join(folder.uri.fsPath, this._configPath);
            mkdirp(path.dirname(configFullPath), (merr) => {
                if (merr && merr.code !== 'EEXIST') {
                    Logger.error(`Failed to create sub directory for this config. File path: ${configFullPath}`, {
                        error: merr,
                    });
                    return reject(merr);
                }
                fs.access(configFullPath, (err) => {
                    if (err) {
                        const config: TestConfig = this.createDefaultTestConfig(folder.uri);
                        const content: string = JSON.stringify(config, null, 4);
                        fs.writeFile(configFullPath, content, 'utf-8', (writeErr) => {
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

    private createDefaultTestConfig(folder: Uri): TestConfig {
        const projects: ProjectInfo[] = this._projectManager.getProjects(folder);
        const config: TestConfig = {
            run: {
                default: '',
                items: projects.map((i) => {
                    return {
                        name: i.name,
                        projectName: i.name,
                        workingDirectory: workspace.getWorkspaceFolder(i.path).uri.fsPath,
                        args: [],
                        vmargs: [],
                        preLaunchTask: '',
                    };
                }),
            },
            debug: {
                default: '',
                items: projects.map((i) => {
                    return {
                        name: i.name,
                        projectName: i.name,
                        workingDirectory: workspace.getWorkspaceFolder(i.path).uri.fsPath,
                        args: [],
                        vmargs: [],
                        preLaunchTask: '',
                    };
                }),
            },
        };
        return config;
    }
}
