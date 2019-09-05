// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import { default as getPort } from 'get-port';
import * as iconv from 'iconv-lite';
import { createServer, Server, Socket } from 'net';
import * as os from 'os';
import * as path from 'path';
import { DebugConfiguration, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { LOCAL_HOST } from '../../constants/configs';
import { logger } from '../../logger/logger';
import { ITestItem } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import { testResultManager } from '../../testResultManager';
import * as classpathUtils from '../../utils/classpathUtils';
import { resolveRuntimeClassPath } from '../../utils/commandUtils';
import { isTestMethodName } from '../../utils/protocolUtils';
import { ITestRunner } from '../ITestRunner';
import { ITestResult } from '../models';
import { BaseRunnerResultAnalyzer } from './BaseRunnerResultAnalyzer';

export abstract class BaseRunner implements ITestRunner {
    protected tests: ITestItem[];
    protected storagePathForCurrentSession: string | undefined;
    protected server: Server;
    protected socket: Socket;
    protected isCanceled: boolean;
    protected runnerResultAnalyzer: BaseRunnerResultAnalyzer;

    constructor(
        protected javaHome: string,
        protected storagePath: string | undefined,
        protected extensionPath: string) {}

    public abstract get testResultAnalyzer(): BaseRunnerResultAnalyzer;

    public get runnerDir(): string {
        return path.join(this.extensionPath, 'server');
    }

    public get runnerMainClassName(): string {
        return 'com.microsoft.java.test.runner.Launcher';
    }

    public async run(launchConfiguration: DebugConfiguration): Promise<ITestResult[]> {
        let data: string = '';
        return new Promise<ITestResult[]>((resolve: (result: ITestResult[]) => void, reject: (error: Error) => void): void => {
            this.server.on('connection', (socket: Socket) => {
                this.socket = socket;
                socket.on('error', (err: Error) => {
                    return reject(err);
                });

                socket.on('data', (buffer: Buffer) => {
                    data = data.concat(iconv.decode(buffer, launchConfiguration.encoding));
                    const index: number = data.lastIndexOf(os.EOL);
                    if (index >= 0) {
                        this.testResultAnalyzer.analyzeData(data.substring(0, index + os.EOL.length));
                        data = data.substring(index + os.EOL.length);
                    }
                });

                socket.on('close', (had_error: boolean) => {
                    if (had_error) {
                        return reject(new Error(`Launcher failed to run.`));
                    }
                    if (this.isCanceled) {
                        return resolve([]);
                    }
                    if (data.length > 0) {
                        this.testResultAnalyzer.analyzeData(data);
                    }
                    return resolve(this.testResultAnalyzer.feedBack());
                });
            });

            this.server.on('error', (err: Error) => {
                return reject(err);
            });

            this.launchTests(launchConfiguration);
        });
    }

    public async setup(tests: ITestItem[], isDebug: boolean = false, config?: IExecutionConfig): Promise<DebugConfiguration> {
        await this.startSocketServer();

        this.clearTestResults(tests);
        this.tests = tests;
        const testPaths: string[] = tests.map((item: ITestItem) => Uri.parse(item.location.uri).fsPath);
        const classpaths: string[] = [...await resolveRuntimeClassPath(testPaths), await this.getRunnerJarFilePath(), await this.getRunnerLibPath()];
        this.storagePathForCurrentSession = path.join(this.storagePath || os.tmpdir(), new Date().getTime().toString());
        const classPathString: string = await classpathUtils.getClassPathString(classpaths, this.storagePathForCurrentSession);

        let env: {} = process.env;
        if (config && config.env) {
            env = {...env, ...config.env};
        }

        return {
            name: 'Launch Java Tests',
            type: 'java',
            request: 'launch',
            mainClass: this.runnerMainClassName,
            projectName: tests[0].project,
            cwd: config ? config.workingDirectory : undefined,
            classPaths: classPathString,
            args: this.getApplicationArgs(config),
            vmArgs: this.getVmArgs(config),
            encoding: this.getJavaEncoding(config),
            env,
            noDebug: !isDebug ? true : false,
        };
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        this.isCanceled = isCancel;
        try {
            if (this.storagePathForCurrentSession) {
                await fse.remove(this.storagePathForCurrentSession);
                this.storagePathForCurrentSession = undefined;
            }
            if (this.socket) {
                this.socket.destroy();
            }
            this.server.removeAllListeners();
            this.server.close(() => {
                this.server.unref();
            });
        } catch (error) {
            logger.error('Failed to clean up', error);
        }
    }

    protected getVmArgs(config?: IExecutionConfig): string[] {
        const vmArgs: string[] = [];
        vmArgs.push('-ea');

        if (config && config.vmargs) {
            vmArgs.push(...config.vmargs.filter(Boolean));
        }

        return vmArgs;
    }

    protected getApplicationArgs(config?: IExecutionConfig): string[] {
        const applicationArgs: string[] = [];
        applicationArgs.push(`${this.server.address().port}`);

        applicationArgs.push(...this.getRunnerCommandParams(config));

        if (config && config.args) {
            applicationArgs.push(...config.args.filter(Boolean));
        }

        return applicationArgs;
    }

    protected abstract async launchTests(launchConfiguration: DebugConfiguration): Promise<void>;

    protected getRunnerCommandParams(_config?: IExecutionConfig): string[] {
        return [];
    }

    protected getJavaEncoding(config?: IExecutionConfig): string {
        const encoding: string = this.getEncodingFromTestConfig(config) || this.getEncodingFromSetting();
        if (!iconv.encodingExists(encoding)) {
            logger.error(`Unsupported encoding: ${encoding}, fallback to UTF-8.`);
            return 'utf8';
        }
        return encoding;
    }

    protected clearTestResults(items: ITestItem[]): void {
        for (const item of items) {
            if (isTestMethodName(item.fullName)) {
                testResultManager.removeResultDetails(Uri.parse(item.location.uri).fsPath, item.fullName);
            } else {
                testResultManager.removeResultDetailsUnderTheClass(Uri.parse(item.location.uri).fsPath, item.fullName);
            }
        }
    }

    protected async startSocketServer(): Promise<void> {
        this.server = createServer();
        const socketPort: number = await getPort();
        this.server.listen(socketPort, LOCAL_HOST);
    }

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

    private getEncodingFromTestConfig(config?: IExecutionConfig): string | undefined {
        if (config && config.vmargs) {
            const vmArgsString: string = config.vmargs.join(' ');
            const encodingKey: string = '-Dfile.encoding=';
            const index: number = vmArgsString.lastIndexOf(encodingKey);
            if (index > -1) {
                // loop backwards since the latter vmarg will override the previous one
                return vmArgsString.slice(index + encodingKey.length).split(' ')[0];
            }
        }
        return undefined;
    }

    private getEncodingFromSetting(): string {
        let javaEncoding: string | null = null;
        // One runner will contain all tests in one workspace with the same test framework.
        const config: WorkspaceConfiguration = workspace.getConfiguration(undefined, Uri.parse(this.tests[0].location.uri));
        const languageConfig: {} | undefined = config.get('[java]');
        if (languageConfig != null) {
            javaEncoding = languageConfig['files.encoding'];
        }

        if (javaEncoding == null) {
            javaEncoding = config.get<string>('files.encoding', 'UTF-8');
        }
        return javaEncoding;
    }
}
