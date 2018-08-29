// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as getPort from 'get-port';
import * as os from 'os';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as kill from 'tree-kill';
import { debug, window, workspace, EventEmitter, Uri } from 'vscode';
import { ClassPathManager } from '../../classPathManager';
import { ProjectManager } from '../../projectManager';
import { TestSuite } from '../../Models/protocols';
import { RunConfigItem } from '../../Models/testConfig';
import { ClassPathUtility } from '../../Utils/classPathUtility';
import * as Logger from '../../Utils/Logger/logger';
import { ITestResult } from '../testModel';
import { ITestRunner } from '../testRunner';
import { ITestRunnerParameters } from '../testRunnerParameters';
import { IJarFileTestRunnerParameters } from './jarFileRunnerParameters';
import { JarFileRunnerResultAnalyzer } from './jarFileRunnerResultAnalyzer';

export abstract class JarFileTestRunner implements ITestRunner {
    private _process: cp.ChildProcess;
    private _isCancelled: boolean;
    constructor(
        protected _javaHome: string,
        protected _storagePath: string,
        protected _classPathManager: ClassPathManager,
        protected _projectManager: ProjectManager,
        protected _onDidChange: EventEmitter<void>) {
    }

    public abstract get debugConfigName(): string;
    public abstract get runnerJarFilePath(): string;
    public abstract get runnerClassName(): string;
    public abstract constructCommand(params: IJarFileTestRunnerParameters): Promise<string[]>;
    public abstract getTestResultAnalyzer(params: IJarFileTestRunnerParameters): JarFileRunnerResultAnalyzer;
    public abstract clone(): ITestRunner;

    public async setup(tests: TestSuite[], isDebugMode: boolean, config: RunConfigItem): Promise<ITestRunnerParameters> {
        const uris: Uri[] = tests.map((t) => Uri.parse(t.uri));
        const classpaths: string[] = this._classPathManager.getClassPaths(uris);
        const port: number | undefined = isDebugMode ? await this.getPortWithWrapper() : undefined;
        const storageForThisRun: string = path.join(this._storagePath, new Date().getTime().toString());
        const runnerJarFilePath: string = this.runnerJarFilePath;
        if (runnerJarFilePath === null) {
            const err = 'Failed to locate test server runtime!';
            Logger.error(err);
            return Promise.reject(err);
        }
        const extendedClasspaths = [runnerJarFilePath, ...classpaths];
        const runnerClassName: string = this.runnerClassName;
        const classpathStr: string = await this.constructClassPathStr(extendedClasspaths, storageForThisRun);
        const params: IJarFileTestRunnerParameters = {
            tests,
            isDebugMode,
            port,
            classpathStr,
            runnerJarFilePath,
            runnerClassName,
            storagePath: storageForThisRun,
            config,
        };

        return params;
    }

    public async run(env: ITestRunnerParameters): Promise<ITestResult[]> {
        const jarParams: IJarFileTestRunnerParameters = env as IJarFileTestRunnerParameters;
        if (!jarParams) {
            return Promise.reject('Illegal env type, should pass in IJarFileTestRunnerParameters!');
        }
        const command: string[] = await this.constructCommandWithWrapper(jarParams);
        const cwd = env.config ? env.config.workingDirectory : this._projectManager.getProjectPath(Uri.parse(env.tests[0].uri)).fsPath;
        const options = { cwd, env: process.env };
        if (env.config && env.config.env) {
            options.env = {...env.config.env, ...options.env};
        }
        this._process = cp.spawn(command[0], command.slice(1), options);
        return new Promise<ITestResult[]>((resolve, reject) => {
            const testResultAnalyzer: JarFileRunnerResultAnalyzer = this.getTestResultAnalyzer(jarParams);
            let bufferred: string = '';
            this._process.on('error', (err) => {
                Logger.error(
                    `Error occurred while running/debugging tests.`,
                    {
                        name: err.name,
                        message: err.message,
                        stack: err.stack,
                    });
                reject([err]);
            });
            this._process.stderr.on('data', (data) => {
                testResultAnalyzer.analyzeError(data.toString());
            });
            this._process.stdout.on('data', (data) => {
                Logger.info(data.toString());
                bufferred = bufferred.concat(data.toString());
                const index = bufferred.lastIndexOf(os.EOL);
                if (index >= 0) {
                    testResultAnalyzer.analyzeData(bufferred.substring(0, index));
                    bufferred = bufferred.substring(index + os.EOL.length);
                }
            });
            this._process.on('close', (signal) => {
                if (bufferred.length > 0) {
                    testResultAnalyzer.analyzeData(bufferred);
                }
                const result = testResultAnalyzer.feedBack(this._isCancelled);
                if (signal && signal !== 0) {
                    reject([`Runner exited with code ${signal}.`, result]);
                } else {
                    resolve(result);
                }
                rimraf(jarParams.storagePath, (err) => {
                    if (err) {
                        Logger.error(`Failed to delete storage for this run.`, {
                            error: err,
                        });
                    }
                });
            });
            if (jarParams.isDebugMode) {
                const uri = Uri.parse(jarParams.tests[0].uri);
                const rootDir = workspace.getWorkspaceFolder(Uri.file(uri.fsPath));
                setTimeout(() => {
                    debug.startDebugging(rootDir, {
                        name: this.debugConfigName,
                        type: 'java',
                        request: 'attach',
                        hostName: 'localhost',
                        port: jarParams.port,
                        projectName: env.config ? env.config.projectName : undefined,
                    });
                }, 500);
            }
        }).then((result) => {
            this._process = undefined;
            return result;
        }, (error) => {
            this._process = undefined;
            throw error;
        });
    }

    public postRun(): Promise<void> {
        this._onDidChange.fire();
        return Promise.resolve();
    }

    public cancel(): Promise<void> {
        if (this._process) {
            Logger.warn('Cancelling this test run...', undefined, true);
            return new Promise((resolve, reject) => {
                this._isCancelled = true;
                kill(this._process.pid, 'SIGTERM', (err) => {
                    if (err) {
                        Logger.error('Failed to cancel this test run.', {
                            error: err,
                        });
                        return reject(err);
                    }
                    resolve();
                });
            });
        }
        return Promise.resolve();
    }

    private async getPortWithWrapper(): Promise<number> {
        try {
            return await getPort();
        } catch (ex) {
            const message = `Failed to get free port for debugging. Details: ${ex}.`;
            window.showErrorMessage(message);
            Logger.error(message, {
                error: ex,
            }, true);
            throw ex;
        }
    }

    private async constructClassPathStr(classpaths: string[], storageForThisRun: string): Promise<string> {
        let separator = ';';
        if (process.platform === 'darwin' || process.platform === 'linux') {
            separator = ':';
        }
        return ClassPathUtility.getClassPathStr(classpaths, separator, storageForThisRun);
    }

    private async constructCommandWithWrapper(params: IJarFileTestRunnerParameters): Promise<string[]> {
        try {
            return await this.constructCommand(params);
        } catch (ex) {
            Logger.error(`Exception occurred while parsing params. Details: ${ex}`, {
                error: ex,
            });
            rimraf(params.storagePath, (err) => {
                if (err) {
                    Logger.error(`Failed to delete storage for this run.`, {
                        error: err,
                    });
                }
            });
            throw ex;
        }
    }
}
