// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import { default as getPort } from 'get-port';
import * as iconv from 'iconv-lite';
import { createServer, Server, Socket } from 'net';
import * as os from 'os';
import * as path from 'path';
import { debug, DebugConfiguration, DebugSession, Disposable, Uri, workspace } from 'vscode';
import { LOCAL_HOST } from '../../constants/configs';
import { logger } from '../../logger/logger';
import { ITestItem } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import { testResultManager } from '../../testResultManager';
import { isTestMethodName } from '../../utils/protocolUtils';
import { ITestRunner } from '../ITestRunner';
import { ITestResult } from '../models';
import { BaseRunnerResultAnalyzer } from './BaseRunnerResultAnalyzer';

export abstract class BaseRunner implements ITestRunner {
    protected tests: ITestItem[];
    protected server: Server;
    protected socket: Socket;
    protected runnerResultAnalyzer: BaseRunnerResultAnalyzer;

    private disposables: Disposable[] = [];

    constructor(
        protected javaHome: string,
        protected extensionPath: string) {}

    public async setup(tests: ITestItem[]): Promise<void> {
        await this.startSocketServer();
        this.clearTestResults(tests);
        this.tests = tests;
    }

    public async run(launchConfiguration: DebugConfiguration): Promise<ITestResult[]> {
        let data: string = '';
        this.server.on('connection', (socket: Socket) => {
            this.socket = socket;
            socket.on('error', (err: Error) => {
                throw err;
            });

            socket.on('data', (buffer: Buffer) => {
                data = data.concat(iconv.decode(buffer, launchConfiguration.encoding || 'utf8'));
                const index: number = data.lastIndexOf(os.EOL);
                if (index >= 0) {
                    this.testResultAnalyzer.analyzeData(data.substring(0, index + os.EOL.length));
                    data = data.substring(index + os.EOL.length);
                }
            });

            socket.on('error', (err: Error) => {
                throw err;
            });

            this.server.on('error', (err: Error) => {
                throw err;
            });
        });

        const uri: Uri = Uri.parse(this.tests[0].location.uri);
        logger.verbose(`Launching with the following launch configuration: '${JSON.stringify(launchConfiguration, null, 2)}'\n`);

        return await debug.startDebugging(workspace.getWorkspaceFolder(uri), launchConfiguration).then(async (success: boolean) => {
            if (!success) {
                this.tearDown();
                return [];
            }

            return await new Promise<ITestResult[]>((resolve: (result: ITestResult[]) => void): void => {
                this.disposables.push(
                    debug.onDidTerminateDebugSession((session: DebugSession): void => {
                        if (launchConfiguration.name === session.name) {
                            this.tearDown();
                            if (data.length > 0) {
                                this.testResultAnalyzer.analyzeData(data);
                            }
                            return resolve(this.testResultAnalyzer.feedBack());
                        }
                    }),
                );
            });
        }, ((reason: any): any => {
            logger.error(`${reason}`);
            this.tearDown();
            return [];
        }));
    }

    public async tearDown(): Promise<void> {
        try {
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.destroy();
            }
            if (this.server) {
                this.server.removeAllListeners();
                this.server.close(() => {
                    this.server.unref();
                });
            }
            for (const disposable of this.disposables) {
                disposable.dispose();
            }
        } catch (error) {
            logger.error('Failed to clean up', error);
        }
    }

    public get runnerJarFilePath(): Promise<string> {
        return this.getPath('com.microsoft.java.test.runner.jar');
    }

    public get runnerLibPath(): Promise<string> {
        return this.getPath('lib');
    }

    public get runnerMainClassName(): string {
        return 'com.microsoft.java.test.runner.Launcher';
    }

    public get serverPort(): number {
        const address: { port: number; family: string; address: string; } = this.server.address();
        if (address) {
            return address.port;
        }

        throw new Error('The socket server is not started yet.');
    }

    public getApplicationArgs(config?: IExecutionConfig): string[] {
        const applicationArgs: string[] = [];
        applicationArgs.push(`${this.server.address().port}`);

        applicationArgs.push(...this.getRunnerCommandParams(config));

        if (config && config.args) {
            applicationArgs.push(...config.args.filter(Boolean));
        }

        return applicationArgs;
    }

    protected abstract get testResultAnalyzer(): BaseRunnerResultAnalyzer;

    protected get runnerDir(): string {
        return path.join(this.extensionPath, 'server');
    }

    protected getRunnerCommandParams(_config?: IExecutionConfig): string[] {
        return [];
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
        await new Promise((resolve: () => void): void => {
            this.server.listen(socketPort, LOCAL_HOST, resolve);
        });
    }

    private async getPath(subPath: string): Promise<string> {
        const fullPath: string = path.join(this.runnerDir, subPath);
        if (await fse.pathExists(fullPath)) {
            return fullPath;
        }
        throw new Error(`Failed to find path: ${fullPath}`);
    }
}

export interface IJUnitLaunchArguments {
    mainClass: string;
    projectName: string;
    classpath: string[];
    modulepath: string[];
    vmArguments: string[];
    programArguments: string[];
}
