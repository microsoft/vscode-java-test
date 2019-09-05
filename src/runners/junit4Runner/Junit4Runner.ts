// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { default as getPort } from 'get-port';
import * as iconv from 'iconv-lite';
import { Server, Socket } from 'net';
import * as os from 'os';
import * as path from 'path';
import { debug, Uri, workspace } from 'vscode';
import { ISearchTestItemParams, ITestItem, TestLevel } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import { resolveJUnitLaunchArguments } from '../../utils/commandUtils';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { ITestResult } from '../models';
import { JUnit4RunnerResultAnalyzer } from './JUnit4RunnerResultAnalyzer';

export class JUnit4Runner extends BaseRunner {

    private arguments: IJUnitLaunchArguments;

    public async setup(tests: ITestItem[], isDebug: boolean = false, server: Server, config?: IExecutionConfig, searchParam?: ISearchTestItemParams): Promise<void> {
        this.port = isDebug ? await getPort() : undefined;
        this.tests = tests;
        this.isDebug = isDebug;
        this.server = server;
        this.storagePathForCurrentSession = path.join(this.storagePath || os.tmpdir(), new Date().getTime().toString());
        let className: string = '';
        let methodName: string = '';
        let runFromRoot: boolean = false;
        let uri: string = '';

        if (!searchParam || searchParam.level === TestLevel.Class || searchParam.level === TestLevel.Method) {
            const nameArray: string[] = tests[0].fullName.split('#');
            className = nameArray[0];
            if (nameArray.length > 1) {
                methodName = nameArray[1];
            }
        }

        if (searchParam) {
            if (searchParam.level === TestLevel.Root) {
                runFromRoot = true;
                uri = workspace.getWorkspaceFolder(Uri.parse(tests[0].location.uri))!.uri.toString();
            } else {
                uri = searchParam.uri;
            }
        } else {
            uri = tests[0].location.uri;
        }
        this.arguments = await resolveJUnitLaunchArguments(uri, className, methodName, runFromRoot);
        this.config = config;
        this.encoding = this.getJavaEncoding();
        this.clearTestResults(tests);
    }

    public async run(): Promise<ITestResult[]> {
        return new Promise<ITestResult[]>((resolve: (result: ITestResult[]) => void, reject: (error: Error) => void): void => {
            const testResultAnalyzer: BaseRunnerResultAnalyzer = this.getTestResultAnalyzer();
            this.arguments.programArguments.push('-port', `${this.server.address().port}`);
            if (this.config && this.config.vmargs) {
                this.arguments.vmArguments.push(...this.config.vmargs.filter(Boolean));
            }
            let env: {} = process.env;
            if (this.config && this.config.env) {
                env = { ...process.env, ...this.config.env };
            }

            let data: string = '';
            this.server.on('connection', (socket: Socket) => {
                this.socket = socket;
                socket.on('error', (err: Error) => {
                    reject(err);
                });

                socket.on('data', (buffer: Buffer) => {
                    data = data.concat(iconv.decode(buffer, this.encoding));
                    const index: number = data.lastIndexOf(os.EOL);
                    if (index >= 0) {
                        testResultAnalyzer.analyzeData(data.substring(0, index + os.EOL.length));
                        data = data.substring(index + os.EOL.length);
                    }
                });

                socket.on('close', (had_error: boolean) => {
                    if (this.isCanceled) {
                        return resolve([]);
                    }
                    if (data.length > 0) {
                        testResultAnalyzer.analyzeData(data);
                    }
                    const result: ITestResult[] = testResultAnalyzer.feedBack();
                    if (had_error) {
                        reject(new Error(`Launcher failed to run.`));
                    } else {
                        resolve(result);
                    }
                });
            });

            this.server.on('error', (err: Error) => {
                reject(err);
            });

            const uri: Uri = Uri.parse(this.tests[0].location.uri);
            debug.startDebugging(workspace.getWorkspaceFolder(uri), {
                name: 'Launch Java Tests',
                type: 'java',
                request: 'launch',
                mainClass: this.arguments.mainClass,
                projectName: this.arguments.projectName,
                cwd: this.config ? this.config.workingDirectory : undefined,
                classPaths: this.arguments.classpath,
                modulePaths: this.arguments.modulepath,
                args: this.arguments.programArguments,
                vmArgs: this.arguments.vmArguments.join(' '),
                encoding: this.encoding,
                env,
                console: 'internalConsole',
                noDebug: this.isDebug ? false : true,
            });
        });
    }

    public getRunnerCommandParams(): string[] {
        return [];
    }

    public getTestResultAnalyzer(): BaseRunnerResultAnalyzer {
        return new JUnit4RunnerResultAnalyzer(this.tests);
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
