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
            const fullPath = await this.createTestConfigIfNotExisted(f);
            fs.readFile(fullPath, 'utf-8', (readErr, data) => {
                if (readErr) {
                    Logger.error(`Failed to read the test config! Details: ${readErr.message}.`, {
                        error: readErr,
                    });
                    return reject(readErr);
                }
                try {
                    const config: TestConfig = JSON.parse(data) as TestConfig;
                    resolve(config);
                } catch (ex) {
                    Logger.error(`Failed to parse the test config! Details: ${ex.message}.`, {
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
        return this.createTestConfigIfNotExisted(folder).then((fullPath) => {
            return workspace.openTextDocument(fullPath).then((doc) => {
                return window.showTextDocument(doc, editor ? editor.viewColumn : undefined);
            }, (err) => {
                return Promise.reject(err);
            });
        });
    }

    private createTestConfigIfNotExisted(folder: WorkspaceFolder): Promise<string> {
        return this.withRetry(new Promise((resolve, reject) => {
            const configFullPath = path.join(folder.uri.fsPath, this._configPath);
            mkdirp(path.dirname(configFullPath), (merr) => {
                if (merr && merr.code !== 'EEXIST') {
                    Logger.error(`Failed to create sub directory for this config. Details: ${merr.message}.`, {
                        error: merr,
                    });
                    return reject(merr);
                }
                fs.open(configFullPath, 'wx', (err) => {
                    if (err) {
                        if (err.code !== 'EEXIST') {
                            return reject(err);
                        }
                    } else {
                        const config: TestConfig = this.createDefaultTestConfig(folder.uri);
                        const content: string = JSON.stringify(config, null, 4);
                        fs.writeFile(configFullPath, content, 'utf-8', (writeErr) => {
                            if (writeErr) {
                                Logger.error(`Failed to create default test config! Details: ${writeErr.message}.`, {
                                    error: writeErr,
                                });
                                return reject(writeErr);
                            }
                        });
                    }
                    resolve(configFullPath);
                });
            });
        }), Configs.DISK_IO_RETRY_COUNT, Configs.DISK_IO_RETRY_DELAY_MILLISECONDS);
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
                        env: {},
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
                        env: {},
                        preLaunchTask: '',
                    };
                }),
            },
        };
        return config;
    }

    private withRetry<T>(request: Promise<T>, retryTimes: number, retryDelayInMillisecond: number): Promise<T> {
        return new Promise<T>(async (resolve, reject) => {
            let count: number = 0;
            let error;
            while (count < retryTimes) {
                try {
                    const res = await request;
                    resolve(res);
                    return;
                } catch (ex) {
                    error = ex;
                    await new Promise((r) => {
                        setTimeout(() => {
                            r();
                        }, retryDelayInMillisecond);
                    });
                } finally {
                    count++;
                }
            }
            reject(error);
        });
    }
}
