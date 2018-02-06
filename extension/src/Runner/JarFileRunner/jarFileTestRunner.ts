// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from "../../classPathManager";
import { Logger } from "../../logger";
import { TestSuite } from "../../protocols";
import { TestResultAnalyzer } from "../../testResultAnalyzer";
import { TestStatusBarProvider } from "../../testStatusBarProvider";
import { ClassPathUtility } from "../../Utils/classPathUtility";
import { ITestResult } from "../testModel";
import { ITestRunner } from "../testRunner";
import { ITestRunnerParameters } from "../testRunnerParameters";
import { IJarFileTestRunnerParameters } from "./jarFileRunnerParameters";
import { JarFileRunnerResultAnalyzer } from "./jarFileRunnerResultAnalyzer";

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
    public abstract get runnerClassName(): string;
    public abstract constructCommand(params: IJarFileTestRunnerParameters): Promise<string>;
    public abstract getTestResultAnalyzer(params: IJarFileTestRunnerParameters): JarFileRunnerResultAnalyzer;

    public async setup(tests: TestSuite[], isDebugMode: boolean): Promise<ITestRunnerParameters> {
        const uri: Uri = Uri.parse(tests[0].uri);
        const classpaths: string[] = this._classPathManager.getClassPath(uri);
        // TODO: refactor logger, get the session id from logger.
        const transactionId: string = undefined;
        const port: number | undefined = isDebugMode ? await this.getPortWithWrapper(transactionId) : undefined;
        const storageForThisRun: string = path.join(this._storagePath, new Date().getTime().toString());
        const runnerJarFilePath: string = this.runnerJarFilePath;
        if (runnerJarFilePath === null) {
            const err = 'Failed to locate test server runtime!';
            this._logger.logError(err, null, transactionId);
            return Promise.reject(err);
        }
        const extendedClasspaths = [runnerJarFilePath, ...classpaths];
        const runnerClassName: string = this.runnerClassName;
        const classpathStr: string = await this.constructClassPathStr(transactionId, extendedClasspaths, storageForThisRun);
        const params: IJarFileTestRunnerParameters = {
            tests,
            isDebugMode,
            port,
            classpathStr,
            runnerJarFilePath,
            runnerClassName,
            storagePath: storageForThisRun,
            transactionId,
        };

        return params;
    }

    public async run(env: ITestRunnerParameters): Promise<ITestResult[]> {
        const jarParams: IJarFileTestRunnerParameters = env as IJarFileTestRunnerParameters;
        if (!jarParams) {
            return Promise.reject('Illegal env type, should pass in IJarFileTestRunnerParameters!');
        }
        // TODO: refactor logger, no need to pass transactionId around.
        const transactionId = jarParams.transactionId;
        const command: string = await this.constructCommandWithWrapper(jarParams);
        const process = cp.exec(command);
        return new Promise<ITestResult[]>((resolve, reject) => {
            const testResultAnalyzer: JarFileRunnerResultAnalyzer = this.getTestResultAnalyzer(jarParams);
            let error: string = '';
            process.on('error', (err) => {
                this._logger.logError(`Error occured while running/debugging tests. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`,
                    err.stack,
                    jarParams.transactionId);
                reject(err);
            });
            process.stderr.on('data', (data) => {
                error += data.toString();
                this._logger.logError(`Error occured: ${data.toString()}`, null, jarParams.transactionId);
                testResultAnalyzer.analyzeData(data.toString());
            });
            process.stdout.on('data', (data) => {
                this._logger.logInfo(data.toString(), jarParams.transactionId);
                testResultAnalyzer.analyzeData(data.toString());
            });
            process.on('close', () => {
                if (error !== '') {
                    reject(error);
                } else {
                    resolve(testResultAnalyzer.feedBack());
                }
                rimraf(jarParams.storagePath, (err) => {
                    if (err) {
                        this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, jarParams.transactionId);
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
                    });
                }, 500);
            }
        });
    }

    public postRun(): Promise<void> {
        this._onDidChange.fire();
        return Promise.resolve();
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
        let separator = ';';
        if (process.platform === 'darwin' || process.platform === 'linux') {
            separator = ':';
        }
        return ClassPathUtility.getClassPathStr(transactionId, this._logger, classpaths, separator, storageForThisRun);
    }

    private async constructCommandWithWrapper(params: IJarFileTestRunnerParameters): Promise<string> {
        try {
            return await this.constructCommand(params);
        } catch (ex) {
            this._logger.logError(`Exception occers while parsing params. Details: ${ex}`, ex, params.transactionId);
            rimraf(params.storagePath, (err) => {
                if (err) {
                    this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, params.transactionId);
                }
            });
            throw ex;
        }
    }
}
