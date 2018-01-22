// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from "../classPathManager";
import { Logger } from "../logger";
import { TestSuite } from "../protocols";
import { TestResultAnalyzer } from "../testResultAnalyzer";
import { TestStatusBarProvider } from "../testStatusBarProvider";
import { ClassPathUtility } from "../Utils/classPathUtility";
import { ITestRunner } from "./testRunner";
import { ITestRunnerContext, JarFileTestRunnerContext } from "./testRunnerContext";

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
    public abstract parseParams(tests: TestSuite[], isDebugMode: boolean, context: JarFileTestRunnerContext): Promise<string[]>;

    public async setup(tests: TestSuite[], isDebugMode: boolean, context: ITestRunnerContext): Promise<void> {
        const jarContext: JarFileTestRunnerContext = context as JarFileTestRunnerContext;
        if (!jarContext) {
            return Promise.reject('Illegal context type, should pass in JarFileTestRunnerContext!');
        }
        const uri: Uri = Uri.parse(tests[0].uri);
        const classpaths: string[] = this._classPathManager.getClassPath(uri);
        // TODO: refactor logger, no need to pass transactionId around.
        const transactionId = jarContext.transactionId;
        const port: number | undefined = isDebugMode ? await this.getPortWithWrapper(transactionId) : undefined;
        const storageForThisRun: string = path.join(this._storagePath, new Date().getTime().toString());
        const classpathStr: string = await this.constructClassPathStr(transactionId, classpaths, storageForThisRun);
        jarContext.port = port;
        jarContext.storagePath = storageForThisRun;
        jarContext.classpathStr = classpathStr;
    }

    public async run(tests: TestSuite[], isDebugMode: boolean, context: ITestRunnerContext): Promise<void> {
        const jarContext: JarFileTestRunnerContext = context as JarFileTestRunnerContext;
        if (!jarContext) {
            return Promise.reject('Illegal context type, should pass in JarFileTestRunnerContext!');
        }
        // TODO: refactor logger, no need to pass transactionId around.
        const transactionId = jarContext.transactionId;
        const params: string[] = await this.parseParamsWithWrapper(tests, isDebugMode, jarContext);

        const testResultAnalyzer = new TestResultAnalyzer(tests);
        return TestStatusBarProvider.getInstance().update(tests, new Promise((resolve, reject) => {
            let error: string = '';
            const process = cp.exec(params.join(' '));
            process.on('error', (err) => {
                this._logger.logError(`Error occured while running/debugging tests. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`,
                    err.stack,
                    transactionId);
                reject(err);
            });
            process.stderr.on('data', (data) => {
                error += data.toString();
                this._logger.logError(`Error occured: ${data.toString()}`, null, transactionId);
                testResultAnalyzer.sendData(data.toString());
            });
            process.stdout.on('data', (data) => {
                this._logger.logInfo(data.toString(), transactionId);
                testResultAnalyzer.sendData(data.toString());
            });
            process.on('close', () => {
                testResultAnalyzer.feedBack();
                this._onDidChange.fire();
                if (error !== '') {
                    reject(error);
                } else {
                    resolve();
                }
                rimraf(jarContext.storagePath, (err) => {
                    if (err) {
                        this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, transactionId);
                    }
                });
            });
            if (isDebugMode) {
                const uri = Uri.parse(tests[0].uri);
                const rootDir = workspace.getWorkspaceFolder(Uri.file(uri.fsPath));
                setTimeout(() => {
                    debug.startDebugging(rootDir, {
                        name: this.debugConfigName,
                        type: 'java',
                        request: 'attach',
                        hostName: 'localhost',
                        port: jarContext.port,
                    });
                }, 500);
            }
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

    private async parseParamsWithWrapper(tests: TestSuite[], isDebugMode: boolean, context: JarFileTestRunnerContext): Promise<string[]> {
        try {
            return await this.parseParams(tests, isDebugMode, context);
        } catch (ex) {
            this._logger.logError(`Exception occers while parsing params. Details: ${ex}`, ex, context.transactionId);
            rimraf(context.storagePath, (err) => {
                if (err) {
                    this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, context.transactionId);
                }
            });
            throw ex;
        }
    }
}
