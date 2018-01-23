// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from "../classPathManager";
import { Logger } from "../logger";
import { TestSuite } from "../protocols";
import { TestResultAnalyzer } from "../testResultAnalyzer";
import { TestStatusBarProvider } from "../testStatusBarProvider";
import { ClassPathUtility } from "../Utils/classPathUtility";
import { RunnerResultStream } from "./runnerResultStream";
import { ITestRunner } from "./testRunner";
import { ITestRunnerEnvironment, JarFileTestRunnerEnvironment } from "./testRunnerEnvironment";

import * as cp from 'child_process';
import * as getPort from "get-port";
import * as path from 'path';
import * as rimraf from 'rimraf';
import { debug, window, workspace, EventEmitter, Uri } from "vscode";

export abstract class JarFileTestRunner implements ITestRunner {
    constructor(
        protected _javaHome: string,
        protected _storagePath: string,
        protected _classPathManager: ClassPathManager,
        protected _onDidChange: EventEmitter<void>,
        protected _logger: Logger) { // TODO: logger instance would be removed later
    }

    public abstract get debugConfigName(): string;
    public abstract get runnerJarFilePath(): string;
    public abstract parseParams(env: JarFileTestRunnerEnvironment): Promise<string[]>;
    public abstract getTestResultAnalyzer(env: JarFileTestRunnerEnvironment): TestResultAnalyzer;

    public async setup(tests: TestSuite[], isDebugMode: boolean): Promise<ITestRunnerEnvironment> {
        const env: JarFileTestRunnerEnvironment = new JarFileTestRunnerEnvironment();
        const uri: Uri = Uri.parse(tests[0].uri);
        const classpaths: string[] = this._classPathManager.getClassPath(uri);
        // TODO: refactor logger, no need to pass transactionId around.
        const transactionId = env.transactionId;
        const port: number | undefined = isDebugMode ? await this.getPortWithWrapper(transactionId) : undefined;
        const storageForThisRun: string = path.join(this._storagePath, new Date().getTime().toString());
        const classpathStr: string = await this.constructClassPathStr(transactionId, classpaths, storageForThisRun);
        env.tests = tests;
        env.isDebugMode = isDebugMode;
        env.port = port;
        env.storagePath = storageForThisRun;
        env.classpathStr = classpathStr;
        return env;
    }

    public async run(env: ITestRunnerEnvironment): Promise<RunnerResultStream> {
        const jarEnv: JarFileTestRunnerEnvironment = env as JarFileTestRunnerEnvironment;
        if (!jarEnv) {
            return Promise.reject('Illegal env type, should pass in JarFileTestRunnerEnvironment!');
        }
        // TODO: refactor logger, no need to pass transactionId around.
        const transactionId = jarEnv.transactionId;
        const params: string[] = await this.parseParamsWithWrapper(jarEnv);
        const process = cp.exec(params.join(' '));
        const result: RunnerResultStream = new RunnerResultStream(process.stderr, process.stdout);
        process.on('error', (err) => {
            result.emit('error', err);
        });
        process.on('close', () => {
            result.emit('finish');
        });
        if (jarEnv.isDebugMode) {
            const uri = Uri.parse(jarEnv.tests[0].uri);
            const rootDir = workspace.getWorkspaceFolder(Uri.file(uri.fsPath));
            setTimeout(() => {
                debug.startDebugging(rootDir, {
                    name: this.debugConfigName,
                    type: 'java',
                    request: 'attach',
                    hostName: 'localhost',
                    port: jarEnv.port,
                });
            }, 500);
        }
        return result;
    }

    public async updateTestStatus(env: ITestRunnerEnvironment, result: RunnerResultStream): Promise<void> {
        const jarEnv: JarFileTestRunnerEnvironment = env as JarFileTestRunnerEnvironment;
        if (!jarEnv) {
            return Promise.reject('Illegal env type, should pass in JarFileTestRunnerEnvironment!');
        }
        return TestStatusBarProvider.getInstance().update(jarEnv.tests, new Promise((resolve, reject) => {
            const testResultAnalyzer = this.getTestResultAnalyzer(jarEnv);
            let error: string = '';
            result.on('error', (err) => {
                this._logger.logError(`Error occured while running/debugging tests. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`,
                    err.stack,
                    jarEnv.transactionId);
                reject(err);
            });
            result.stderr.on('data', (data) => {
                error += data.toString();
                this._logger.logError(`Error occured: ${data.toString()}`, null, jarEnv.transactionId);
                testResultAnalyzer.sendData(data.toString());
            });
            result.stdout.on('data', (data) => {
                this._logger.logInfo(data.toString(), jarEnv.transactionId);
                testResultAnalyzer.sendData(data.toString());
            });
            result.on('finish', () => {
                testResultAnalyzer.feedBack();
                this._onDidChange.fire();
                if (error !== '') {
                    reject(error);
                } else {
                    resolve();
                }
                rimraf(jarEnv.storagePath, (err) => {
                    if (err) {
                        this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, jarEnv.transactionId);
                    }
                });
            });
        }));
    }

    private async getPortWithWrapper(transactionId: string): Promise<number> {
        try {
            return await getPort();
        } catch (ex) {
            const message = `Failed to get free port for debugging. Details: ${ex}.`;
            window.showErrorMessage(message);
            this._logger.logError(message, ex, transactionId);
            throw ex;
        }
    }

    private async constructClassPathStr(transactionId: string, classpaths: string[], storageForThisRun: string): Promise<string> {
        const runnerJar: string = this.runnerJarFilePath;
        if (runnerJar === null) {
            const err = 'Failed to locate test server runtime!';
            this._logger.logError(err, null, transactionId);
            return Promise.reject(err);
        }
        const extendedClasspaths = [runnerJar, ...classpaths];
        let separator = ';';
        if (process.platform === 'darwin' || process.platform === 'linux') {
            separator = ':';
        }
        return ClassPathUtility.getClassPathStr(transactionId, this._logger, extendedClasspaths, separator, storageForThisRun);
    }

    private async parseParamsWithWrapper(env: JarFileTestRunnerEnvironment): Promise<string[]> {
        try {
            return await this.parseParams(env);
        } catch (ex) {
            this._logger.logError(`Exception occers while parsing params. Details: ${ex}`, ex, env.transactionId);
            rimraf(env.storagePath, (err) => {
                if (err) {
                    this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, env.transactionId);
                }
            });
            throw ex;
        }
    }
}
