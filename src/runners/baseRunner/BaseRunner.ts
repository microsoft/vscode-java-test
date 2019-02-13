// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as getPort from 'get-port';
import * as os from 'os';
import * as path from 'path';
import { debug, Uri, workspace } from 'vscode';
import { CHILD_PROCESS_MAX_BUFFER_SIZE } from '../../constants/configs';
import { logger } from '../../logger/logger';
import { ITestItem } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import * as classpathUtils from '../../utils/classpathUtils';
import { resolveRuntimeClassPath } from '../../utils/commandUtils';
import { killProcess } from '../../utils/cpUtils';
import { ITestRunner } from '../ITestRunner';
import { ITestResult } from '../models';
import { BaseRunnerResultAnalyzer } from './BaseRunnerResultAnalyzer';

export abstract class BaseRunner implements ITestRunner {
    protected process: cp.ChildProcess | undefined;
    protected storagePathForCurrentSession: string | undefined;
    protected port: number | undefined;
    protected tests: ITestItem[];
    protected isDebug: boolean;
    protected classpath: string;
    protected config: IExecutionConfig | undefined;
    protected isCanceled: boolean;

    constructor(
        protected javaHome: string,
        protected storagePath: string | undefined,
        protected extensionPath: string) {}

    public abstract getTestResultAnalyzer(): BaseRunnerResultAnalyzer;

    public get runnerDir(): string {
        return path.join(this.extensionPath, 'server');
    }

    public get runnerMainClassName(): string {
        return 'com.microsoft.java.test.runner.Launcher';
    }

    public async setup(tests: ITestItem[], isDebug: boolean = false, config?: IExecutionConfig): Promise<void> {
        this.port = isDebug ? await getPort() : undefined;
        this.tests = tests;
        this.isDebug = isDebug;
        const testPaths: string[] = tests.map((item: ITestItem) => Uri.parse(item.uri).fsPath);
        const classpaths: string[] = [...await resolveRuntimeClassPath(testPaths), await this.getRunnerJarFilePath(), await this.getRunnerLibPath()];
        this.storagePathForCurrentSession = path.join(this.storagePath || os.tmpdir(), new Date().getTime().toString());
        this.classpath = await classpathUtils.getClassPathString(classpaths, this.storagePathForCurrentSession);
        this.config = config;
    }

    public async run(): Promise<ITestResult[]> {
        const commandParams: string[] = await this.constructCommandParams();
        const options: cp.SpawnOptions = { cwd: this.config ? this.config.workingDirectory : undefined, env: process.env };
        if (this.config && this.config.env) {
            options.env = {...this.config.env, ...options.env};
        }
        return new Promise<ITestResult[]>((resolve: (result: ITestResult[]) => void, reject: (error: Error) => void): void => {
            const testResultAnalyzer: BaseRunnerResultAnalyzer = this.getTestResultAnalyzer();
            let buffer: string = '';
            this.process = cp.spawn(path.join(this.javaHome, 'bin', 'java'), commandParams, options);
            this.process.on('error', (error: Error) => {
                logger.error('Failed to launch the runner', error);
                reject(error);
            });
            this.process.stderr.on('data', (data: Buffer) => {
                testResultAnalyzer.analyzeError(data.toString());
            });
            this.process.stdout.on('data', (data: Buffer) => {
                buffer = buffer.concat(data.toString());
                const index: number = buffer.lastIndexOf(os.EOL);
                if (index >= 0) {
                    testResultAnalyzer.analyzeData(buffer.substring(0, index));
                    buffer = buffer.substring(index);
                }
            });
            this.process.on('close', (signal: number) => {
                if (this.isCanceled) {
                    return resolve([]);
                }
                if (buffer.length > 0) {
                    testResultAnalyzer.analyzeData(buffer);
                }
                const result: ITestResult[] = testResultAnalyzer.feedBack();
                if (signal && signal !== 0) {
                    reject(new Error(`Runner exited with code ${signal}.`));
                } else {
                    resolve(result);
                }
            });
            if (this.isDebug) {
                const uri: Uri = Uri.parse(this.tests[0].uri);
                setTimeout(() => {
                    debug.startDebugging(workspace.getWorkspaceFolder(uri), {
                        name: 'Debug Java Tests',
                        type: 'java',
                        request: 'attach',
                        hostName: 'localhost',
                        port: this.port,
                        // Tests in each runner has been classified according to the project they belong to
                        projectName: this.tests[0].project,
                    });
                }, 500);
            }
        });
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        this.isCanceled = isCancel;
        try {
            if (this.process) {
                await killProcess(this.process);
                this.process = undefined;
            }
            if (this.storagePathForCurrentSession) {
                await fse.remove(this.storagePathForCurrentSession);
                this.storagePathForCurrentSession = undefined;
            }
        } catch (error) {
            logger.error('Failed to clean up', error);
        }
    }

    public constructCommandParams(): string[] {
        const commandParams: string[] = [];
        commandParams.push('-cp', this.classpath);

        if (this.isDebug) {
            commandParams.push('-Xdebug', `-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=${this.port}`);
        }

        if (this.config && this.config.vmargs) {
            commandParams.push(...this.config.vmargs.filter(Boolean));
        }

        commandParams.push(this.runnerMainClassName);

        commandParams.push(...this.getRunnerCommandParams());

        if (this.config && this.config.args) {
            commandParams.push(...this.config.args.filter(Boolean));
        }

        return commandParams;
    }

    public async execPreLaunchTaskIfExist(): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
            if (!this.config || !this.config.preLaunchTask) {
                return resolve();
            }

            this.process = cp.exec(
                this.config.preLaunchTask,
                {
                    maxBuffer: CHILD_PROCESS_MAX_BUFFER_SIZE,
                    cwd: this.config.workingDirectory,
                },
            );

            this.process.on('error', (err: Error) => {
                logger.error('Failed to run pre-launch task', err);
                return reject(err);
            });
            this.process.stderr.on('data', (data: Buffer) => {
                logger.info(data.toString());
            });
            this.process.stdout.on('data', (data: Buffer) => {
                logger.info(data.toString());
            });
            this.process.on('close', (signal: number) => {
                if (signal && signal !== 0) {
                    return reject(new Error(`Prelaunch task exited with code ${signal}.`));
                } else {
                    return resolve();
                }
            });
        });
    }

    protected abstract getRunnerCommandParams(): string[];

    private async getRunnerJarFilePath(): Promise<string> {
        return this.getPath('com.microsoft.java.test.runner.jar');
    }

    private async getRunnerLibPath(): Promise<string> {
        return this.getPath('lib');
    }

    private async getPath(subPath: string): Promise<string> {
        const fullPath: string = path.join(this.runnerDir, subPath);
        if (await fse.pathExists(fullPath)) {
            return fullPath;
        }
        throw new Error(`Failed to find path: ${fullPath}`);
    }
}
