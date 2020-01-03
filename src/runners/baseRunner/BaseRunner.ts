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
import { ITestItem, TestLevel } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import { testItemModel } from '../../testItemModel';
import { testResultManager } from '../../testResultManager';
import { ITestRunner } from '../ITestRunner';
import { ITestResult, TestStatus } from '../models';
import { BaseRunnerResultAnalyzer } from './BaseRunnerResultAnalyzer';

export abstract class BaseRunner implements ITestRunner {
    protected tests: ITestItem[];
    protected server: Server;
    protected socket: Socket;
    protected runnerResultAnalyzer: BaseRunnerResultAnalyzer;

    private disposables: Disposable[] = [];

    constructor(
        protected extensionPath: string) {}

    public async setup(tests: ITestItem[]): Promise<void> {
        await this.startSocketServer();
        const flattenedTests: ITestItem[] = [];
        for (const test of tests) {
            this.flattenTestItems(test, flattenedTests);
        }
        this.tests = flattenedTests;
        this.updateTestResultsToRunning();
    }

    public async run(launchConfiguration: DebugConfiguration): Promise<Set<string>> {
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

        // Run from integrated terminal will terminate the debug session immediately after launching,
        // So we force to use internal console here to make sure the session is still under debugger's control.
        launchConfiguration.console = 'internalConsole';

        const uri: Uri = Uri.parse(this.tests[0].location.uri);
        logger.verbose(`Launching with the following launch configuration: '${JSON.stringify(launchConfiguration, null, 2)}'\n`);

        return await debug.startDebugging(workspace.getWorkspaceFolder(uri), launchConfiguration).then(async (success: boolean) => {
            if (!success) {
                this.tearDown();
                return this.testResultAnalyzer.tearDown();
            }

            return await new Promise<Set<string>>((resolve: (ids: Set<string>) => void): void => {
                this.disposables.push(
                    debug.onDidTerminateDebugSession((session: DebugSession): void => {
                        if (launchConfiguration.name === session.name) {
                            this.tearDown();
                            if (data.length > 0) {
                                this.testResultAnalyzer.analyzeData(data);
                            }
                            return resolve(this.testResultAnalyzer.tearDown());
                        }
                    }),
                );
            });
        }, ((reason: any): any => {
            logger.error(`${reason}`);
            this.tearDown();
            return this.testResultAnalyzer.tearDown();
        }));
    }

    public async tearDown(): Promise<void> {
        for (const test of this.tests) {
            const result: ITestResult | undefined = testResultManager.getResultById(test.id);
            // In case that unexpected errors terminate the execution
            if (result && result.status === TestStatus.Running) {
                result.status = undefined;
                testResultManager.storeResult(result);
            }
        }
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

    private updateTestResultsToRunning(): void {
        const runningResults: ITestResult[] = [];
        for (const test of this.tests) {
            runningResults.push({
                id: test.id,
                status: TestStatus.Running,
            });
        }
        testResultManager.storeResult(...runningResults);
    }

    private flattenTestItems(test: ITestItem, flattenedItems: ITestItem[]): void {
        if (test.level === TestLevel.Method) {
            flattenedItems.push(test);
        } else if (test.level === TestLevel.Class && test.children) {
            for (const child of test.children) {
                const childItem: ITestItem | undefined = testItemModel.getItemById(child);
                if (childItem) {
                    this.flattenTestItems(childItem, flattenedItems);
                }
            }
        }
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
