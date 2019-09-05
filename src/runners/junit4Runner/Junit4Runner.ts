// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { debug, DebugConfiguration, Uri, workspace } from 'vscode';
import { ISearchTestItemParams, ITestItem } from '../../protocols';
import { IExecutionConfig } from '../../runConfigs';
import { getDebugConfigurationForEclispeRunner as getEclispeJUnitRunnerLaunchConfig } from '../../utils/launchUtils';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnit4RunnerResultAnalyzer } from './JUnit4RunnerResultAnalyzer';

export class JUnit4Runner extends BaseRunner {

    public async setup(tests: ITestItem[], isDebug: boolean = false, config?: IExecutionConfig, searchParam?: ISearchTestItemParams): Promise<DebugConfiguration> {
        await this.startSocketServer();
        this.clearTestResults(tests);
        this.tests = tests;

        return getEclispeJUnitRunnerLaunchConfig(tests[0], this.server.address().port, isDebug, config, searchParam);
    }

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
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
}

export interface IJUnitLaunchArguments {
    mainClass: string;
    projectName: string;
    classpath: string[];
    modulepath: string[];
    vmArguments: string[];
    programArguments: string[];
}
