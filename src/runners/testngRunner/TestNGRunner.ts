// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import { default as getPort } from 'get-port';
import * as iconv from 'iconv-lite';
import * as path from 'path';
import { debug, DebugConfiguration, Uri, workspace } from 'vscode';
import { logger } from '../../logger/logger';
import { ITestItem } from '../../protocols';
import { killProcess } from '../../utils/cpUtils';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { TestNGRunnerResultAnalyzer } from './TestNGRunnerResultAnalyzer';

export class TestNGRunner extends BaseRunner {

    protected process: cp.ChildProcess | undefined;

    public getRunnerCommandParams(): string[] {
        return ['testng', ...this.tests.map((t: ITestItem) => t.fullName)];
    }

    public async cleanUp(isCancel: boolean): Promise<void> {
        super.cleanUp(isCancel);
        try {
            if (this.process) {
                await killProcess(this.process);
                this.process = undefined;
            }
        } catch (error) {
            logger.error('Failed to clean up', error);
        }
    }

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new TestNGRunnerResultAnalyzer(this.tests);
        }
        return this.runnerResultAnalyzer;
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
            commandParams.push('-cp', launchConfiguration.classPaths);
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
}
