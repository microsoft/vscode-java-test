// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { debug, DebugConfiguration, Uri, workspace } from 'vscode';
import { ISearchTestItemParams, ITestItem, TestLevel } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import { resolveJUnitLaunchArguments } from '../../utils/commandUtils';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit4RunnerResultAnalyzer } from './JUnit4RunnerResultAnalyzer';

export class JUnit4Runner extends BaseRunner {

    public async setup(tests: ITestItem[], isDebug: boolean = false, config?: IExecutionConfig, searchParam?: ISearchTestItemParams): Promise<DebugConfiguration> {
        await this.startSocketServer();
        this.clearTestResults(tests);
        this.tests = tests;
        const junitLaunchArgs: IJUnitLaunchArguments = await this.getJUnitLaunchArguments(tests[0], searchParam);
        junitLaunchArgs.programArguments.push('-port', `${this.server.address().port}`);
        if (config && config.vmargs) {
            junitLaunchArgs.vmArguments.push(...config.vmargs.filter(Boolean));
        }
        let env: {} = process.env;
        if (config && config.env) {
            env = { ...process.env, ...config.env };
        }

        return {
            name: 'Launch Java Tests',
            type: 'java',
            request: 'launch',
            mainClass: junitLaunchArgs.mainClass,
            projectName: junitLaunchArgs.projectName,
            cwd: config ? config.workingDirectory : undefined,
            classPaths: junitLaunchArgs.classpath,
            modulePaths: junitLaunchArgs.modulepath,
            args: junitLaunchArgs.programArguments,
            vmArgs: junitLaunchArgs.vmArguments,
            encoding: this.getJavaEncoding(),
            env,
            console: 'internalConsole',
            noDebug: !isDebug ? true : false,
        };
    }

    public get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new JUnit4RunnerResultAnalyzer(this.tests);
        }
        return this.runnerResultAnalyzer;
    }

    protected async launchTests(launchConfiguration: DebugConfiguration): Promise<void> {
        if (launchConfiguration.args) {
            (launchConfiguration.args as string[]).push('-port', `${this.server.address().port}`);
        }

        const uri: Uri = Uri.parse(this.tests[0].location.uri);
        debug.startDebugging(workspace.getWorkspaceFolder(uri), launchConfiguration);
    }

    private async getJUnitLaunchArguments(test: ITestItem, searchParam?: ISearchTestItemParams): Promise<IJUnitLaunchArguments> {
        let className: string = '';
        let methodName: string = '';
        let runFromRoot: boolean = false;
        let uri: string = '';

        if (!searchParam || searchParam.level === TestLevel.Class || searchParam.level === TestLevel.Method) {
            const nameArray: string[] = test.fullName.split('#');
            className = nameArray[0];
            if (nameArray.length > 1) {
                methodName = nameArray[1];
            }
        }

        if (searchParam) {
            if (searchParam.level === TestLevel.Root) {
                runFromRoot = true;
                uri = workspace.getWorkspaceFolder(Uri.parse(test.location.uri))!.uri.toString();
            } else {
                uri = searchParam.uri;
            }
        } else {
            uri = test.location.uri;
        }

        return await resolveJUnitLaunchArguments(uri, className, methodName, runFromRoot);
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
