// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from "../classPathManager";
import { Logger } from "../logger";
import { TestResultAnalyzer } from "../testResultAnalyzer";
import { TestStatusBarProvider } from "../testStatusBarProvider";
import { ClassPathUtility } from "../Utils/classPathUtility";
import { ITestRunner } from "./testRunner";
import { ITestRunnerContext } from "./testRunnerContext";

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
    public abstract parseParams(context: ITestRunnerContext): Promise<string[]>;

    public async run(context: ITestRunnerContext): undefined | Promise<undefined> {
        const uri: Uri = Uri.parse(context.tests[0].uri);
        const classpaths: string[] = this._classPathManager.getClassPath(uri);
        // TODO: refactor logger, no need to pass transactionId around.
        const transactionId: string = context.contextData.has('transactionId') ? context.contextData.get('transactionId').toString() : undefined;
        const port: number | undefined = context.isDebugMode ? await this.getPortWithWrapper(transactionId) : undefined;
        const storageForThisRun: string = path.join(this._storagePath, new Date().getTime().toString());
        const classpathStr: string = await this.constructClassPathStr(transactionId, classpaths, storageForThisRun);
        if (classpathStr === null) {
            return null;
        }
        context.contextData.set('port', port);
        context.contextData.set('storageForThisRun', storageForThisRun);
        context.contextData.set('classpathStr', classpathStr);
        const params: string[] = await this.parseParamsWithWrapper(transactionId, storageForThisRun, context);

        const testResultAnalyzer = new TestResultAnalyzer(context.tests);
        await TestStatusBarProvider.getInstance().update(context.tests, new Promise((resolve, reject) => {
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
                rimraf(storageForThisRun, (err) => {
                    if (err) {
                        this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, transactionId);
                    }
                });
            });
            if (context.isDebugMode) {
                const rootDir = workspace.getWorkspaceFolder(Uri.file(uri.fsPath));
                setTimeout(() => {
                    debug.startDebugging(rootDir, {
                        name: this.debugConfigName,
                        type: 'java',
                        request: 'attach',
                        hostName: 'localhost',
                        port,
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
            this._logger.logError('Failed to locate test server runtime!', null, transactionId);
            return null;
        }
        const extendedClasspaths = [runnerJar, ...classpaths];
        let separator = ';';
        if (process.platform === 'darwin' || process.platform === 'linux') {
            separator = ':';
        }
        return ClassPathUtility.processLongClassPath(transactionId, this._logger, extendedClasspaths, separator, storageForThisRun);
    }

    private async parseParamsWithWrapper(transactionId: string, storageForThisRun: string, context: ITestRunnerContext): Promise<string[]> {
        try {
            return await this.parseParams(context);
        } catch (ex) {
            this._logger.logError(`Exception occers while parsing params. Details: ${ex}`, ex, transactionId);
            rimraf(storageForThisRun, (err) => {
                if (err) {
                    this._logger.logError(`Failed to delete storage for this run. Storage path: ${err}`, err, transactionId);
                }
            });
            throw ex;
        }
    }
}
