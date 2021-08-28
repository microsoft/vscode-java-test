// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { default as getPort } from 'get-port';
import * as iconv from 'iconv-lite';
import { AddressInfo, createServer, Server, Socket } from 'net';
import * as os from 'os';
import { CancellationToken, debug, DebugConfiguration, DebugSession, Disposable } from 'vscode';
import { sendError } from 'vscode-extension-telemetry-wrapper';
import { Configurations } from '../../constants';
import { IProgressReporter } from '../../debugger.api';
import { IExecutionConfig } from '../../runConfigs';
import { IRunTestContext } from '../../types';
import { ITestRunner } from '../ITestRunner';
import { RunnerResultAnalyzer } from './RunnerResultAnalyzer';

export abstract class BaseRunner implements ITestRunner {
    protected server: Server;
    protected socket: Socket;
    protected runnerResultAnalyzer: RunnerResultAnalyzer;

    private disposables: Disposable[] = [];

    constructor(protected testContext: IRunTestContext) {}

    public async setup(): Promise<void> {
        await this.startSocketServer();
        this.runnerResultAnalyzer = this.getAnalyzer();
    }

    public async run(launchConfiguration: DebugConfiguration, token: CancellationToken, progressReporter?: IProgressReporter): Promise<void> {
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
                    this.runnerResultAnalyzer.analyzeData(data.substring(0, index + os.EOL.length));
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

        let debugSession: DebugSession | undefined;
        this.disposables.push(debug.onDidStartDebugSession((session: DebugSession) => {
            if (session.name === launchConfiguration.name) {
                debugSession = session;
            }
        }));

        if (token.isCancellationRequested || progressReporter?.isCancelled()) {
            this.tearDown();
            return;
        }
        return await debug.startDebugging(this.testContext.workspaceFolder, launchConfiguration).then(async (success: boolean) => {
            if (!success || token.isCancellationRequested) {
                this.tearDown();
                return;
            }

            token.onCancellationRequested(() => {
                debugSession?.customRequest('disconnect', { restart: false });
            });

            return await new Promise<void>((resolve: () => void): void => {
                this.disposables.push(
                    debug.onDidTerminateDebugSession((session: DebugSession): void => {
                        if (launchConfiguration.name === session.name) {
                            debugSession = undefined;
                            this.tearDown();
                            if (data.length > 0) {
                                this.runnerResultAnalyzer.analyzeData(data);
                            }
                            return resolve();
                        }
                    }),
                );
            });
        }, ((): any => {
            this.tearDown();
            return;
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
            sendError(error);
        }
    }

    public getApplicationArgs(config?: IExecutionConfig): string[] {
        const applicationArgs: string[] = [];
        applicationArgs.push(`${(this.server.address() as AddressInfo).port}`);

        applicationArgs.push(...this.getRunnerCommandParams(config));

        if (config && config.args) {
            applicationArgs.push(...config.args.filter(Boolean));
        }

        return applicationArgs;
    }

    protected async startSocketServer(): Promise<void> {
        this.server = createServer();
        const socketPort: number = await getPort();
        await new Promise<void>((resolve: () => void): void => {
            this.server.listen(socketPort, Configurations.LOCAL_HOST, resolve);
        });
    }

    protected getRunnerCommandParams(_config?: IExecutionConfig): string[] {
        return [];
    }

    protected abstract getAnalyzer(): RunnerResultAnalyzer;
}

export interface IJUnitLaunchArguments {
    workingDirectory: string;
    mainClass: string;
    projectName: string;
    classpath: string[];
    modulepath: string[];
    vmArguments: string[];
    programArguments: string[];
}
