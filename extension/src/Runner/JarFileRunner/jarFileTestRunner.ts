// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from '../../classPathManager';
import { TestStatusBarProvider } from '../../testStatusBarProvider';
import * as Configs from '../../Constants/configs';
import { TestSuite } from '../../Models/protocols';
import { RunConfig, TestConfig } from '../../Models/testConfig';
import { ClassPathUtility } from '../../Utils/classPathUtility';
import * as Logger from '../../Utils/Logger/logger';
import { ITestResult } from '../testModel';
import { ITestRunner } from '../testRunner';
import { ITestRunnerParameters } from '../testRunnerParameters';
import { IJarFileTestRunnerParameters } from './jarFileRunnerParameters';
import { JarFileRunnerResultAnalyzer } from './jarFileRunnerResultAnalyzer';

import * as cp from 'child_process';
import * as getPort from 'get-port';
import * as os from 'os';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { debug, window, workspace, EventEmitter, Uri } from 'vscode';

export abstract class JarFileTestRunner implements ITestRunner {
    constructor(
        protected _javaHome: string,
        protected _storagePath: string,
        protected _classPathManager: ClassPathManager,
        protected _onDidChange: EventEmitter<void>) {
    }

    public abstract get debugConfigName(): string;
    public abstract get runnerJarFilePath(): string;
    public abstract get runnerClassName(): string;
    public abstract constructCommand(params: IJarFileTestRunnerParameters): Promise<string>;
    public abstract getTestResultAnalyzer(params: IJarFileTestRunnerParameters): JarFileRunnerResultAnalyzer;

    public async setup(tests: TestSuite[], isDebugMode: boolean, config: RunConfig): Promise<ITestRunnerParameters> {
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
        const command: string = await this.constructCommandWithWrapper(jarParams);
        const cwd = env.config ? env.config.workingDirectory : workspace.getWorkspaceFolder(Uri.parse(env.tests[0].uri)).uri.fsPath;
        const process = cp.exec(command, { maxBuffer: Configs.CHILD_PROCESS_MAX_BUFFER_SIZE, cwd });
        return new Promise<ITestResult[]>((resolve, reject) => {
            const testResultAnalyzer: JarFileRunnerResultAnalyzer = this.getTestResultAnalyzer(jarParams);
            let bufferred: string = '';
            process.on('error', (err) => {
                Logger.error(
                    `Error occurred while running/debugging tests. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`,
                    {
                        stack: err.stack,
                    });
                reject(err);
            });
            process.stderr.on('data', (data) => {
                Logger.error(`Error occurred: ${data.toString()}`);
            });
            process.stdout.on('data', (data) => {
                Logger.info(data.toString());
                const toConsume = bufferred + data.toString();
                const index = toConsume.lastIndexOf(os.EOL);
                if (index >= 0) {
                    testResultAnalyzer.analyzeData(toConsume.substring(0, index));
                    bufferred = toConsume.substring(index + os.EOL.length);
                } else {
                    bufferred = toConsume;
                }
            });
            process.on('close', (signal) => {
                if (signal && signal !== 0) {
                    reject(`Runner exited with code ${signal}.`);
                } else {
                    if (bufferred.length > 0) {
                        testResultAnalyzer.analyzeData(bufferred);
                    }
                    resolve(testResultAnalyzer.feedBack());
                }
                rimraf(jarParams.storagePath, (err) => {
                    if (err) {
                        Logger.error(`Failed to delete storage for this run. Storage path: ${err}`, {
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
        });
    }

    public postRun(): Promise<void> {
        this._onDidChange.fire();
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
            });
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

    private async constructCommandWithWrapper(params: IJarFileTestRunnerParameters): Promise<string> {
        try {
            return await this.constructCommand(params);
        } catch (ex) {
            Logger.error(`Exception occurred while parsing params. Details: ${ex}`, {
                error: ex,
            });
            rimraf(params.storagePath, (err) => {
                if (err) {
                    Logger.error(`Failed to delete storage for this run. Storage path: ${err}`, {
                        error: err,
                    });
                }
            });
            throw ex;
        }
    }
}
