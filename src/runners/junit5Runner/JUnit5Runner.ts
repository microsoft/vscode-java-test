// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import { default as getPort } from 'get-port';
import * as iconv from 'iconv-lite';
import * as os from 'os';
import * as path from 'path';
import { debug, DebugConfiguration, Uri, workspace } from 'vscode';
import { logger } from '../../logger/logger';
import { TestLevel } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import * as classpathUtils from '../../utils/classpathUtils';
import { killProcess } from '../../utils/cpUtils';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit5RunnerResultAnalyzer } from './JUnit5RunnerResultAnalyzer';

export class JUnit5Runner extends BaseRunner {

    // TODO: Use Eclipse runner to launch the tests

    protected process: cp.ChildProcess | undefined;

    public getRunnerCommandParams(config?: IExecutionConfig): string[] {
        const params: string[] = ['junit5'];
        if (!this.hasClassNameParam(config)) {
            // Set --include-classname to '.*' to treat all class name as valid test class.
            // See: https://github.com/microsoft/vscode-java-test/issues/381.
            params.push('--include-classname', '".*"');
        }

        params.push(...this.constructParamsForTests());

        return params;
    }

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new JUnit5RunnerResultAnalyzer(this.tests);
        }
        return this.runnerResultAnalyzer;
    }

    public async tearDown(isCancel: boolean): Promise<void> {
        super.tearDown(isCancel);
        try {
            if (this.process) {
                await killProcess(this.process);
                this.process = undefined;
            }
        } catch (error) {
            logger.error('Failed to clean up', error);
        }
    }

    protected async launchTests(launchConfiguration: DebugConfiguration): Promise<void> {
        const commandParams: string[] = [];
        if (launchConfiguration.vmArgs) {
            commandParams.push(...launchConfiguration.vmArgs);
        }

        const javaDebugPort: number = await getPort();
        if (!launchConfiguration.noDebug) {
            commandParams.push('-Xdebug', `-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=${javaDebugPort}`);
        }

        if (launchConfiguration.encoding) {
            commandParams.push(`-Dfile.encoding=${launchConfiguration.encoding}`);
        }

        if (launchConfiguration.classPaths) {
            this.storagePathForCurrentSession = path.join(this.storagePath || os.tmpdir(), new Date().getTime().toString());
            commandParams.push('-cp', await classpathUtils.getClassPathString(launchConfiguration.classPaths, this.storagePathForCurrentSession));
        }

        if (launchConfiguration.mainClass) {
            commandParams.push(launchConfiguration.mainClass);
        }

        if (launchConfiguration.args) {
            commandParams.push(...launchConfiguration.args);
        }

        const options: cp.SpawnOptions = { cwd: launchConfiguration.cwd, env: launchConfiguration.env };

        this.process = cp.spawn(path.join(this.javaHome, 'bin', 'java'), commandParams, options);
        logger.verbose(`Executing: '${[path.join(this.javaHome, 'bin', 'java'), ...commandParams].join(' ')}'\n`);

        this.process.on('error', (error: Error) => {
            logger.error('Failed to launch the runner', error);
            throw error;
        });

        this.process.stderr.on('data', (buffer: Buffer) => {
            logger.error(iconv.decode(buffer, launchConfiguration.encoding));
        });
        this.process.stdout.on('data', (buffer: Buffer) => {
            logger.info(iconv.decode(buffer, launchConfiguration.encoding));
        });

        if (!launchConfiguration.noDebug) {
            const uri: Uri = Uri.parse(this.tests[0].location.uri);
            setTimeout(() => {
                debug.startDebugging(workspace.getWorkspaceFolder(uri), {
                    name: 'Debug Java Tests',
                    type: 'java',
                    request: 'attach',
                    hostName: 'localhost',
                    port: javaDebugPort,
                    // Tests in each runner has been classified according to the project they belong to
                    projectName: this.tests[0].project,
                });
            }, 500);
        }
    }

    private hasClassNameParam(config?: IExecutionConfig): boolean {
        if (!config || !config.args) {
            return false;
        }

        return config.args.some((element: string) => {
            return element === '-n' || element === '--include-classname';
        });
    }

    private constructParamsForTests(): string[] {
        const params: string[] = [];
        for (const test of this.tests) {
            if (test.level === TestLevel.Class) {
                params.push('-c', test.fullName);
            } else if (test.level === TestLevel.Method) {
                params.push('-m', `${test.fullName}(${test.paramTypes.join(',')})`);
            }
        }
        return params;
    }
}
