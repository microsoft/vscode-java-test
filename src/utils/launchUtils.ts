// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as iconv from 'iconv-lite';
import { DebugConfiguration, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { logger } from '../logger/logger';
import { ITestItem, TestKind } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { BaseRunner } from '../runners/baseRunner/BaseRunner';
import { IJUnitLaunchArguments } from '../runners/junit4Runner/Junit4Runner';
import { resolveJUnitLaunchArguments, resolveRuntimeClassPath } from './commandUtils';

export async function resolveLaunchConfigurationForRunner(runner: BaseRunner, tests: ITestItem[], runnerContext: IRunnerContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    if (tests[0].kind === TestKind.JUnit) {
        return await getDebugConfigurationForEclispeRunner(tests[0], runner.serverPort, runnerContext, config);
    } else {
        const testPaths: string[] = tests.map((item: ITestItem) => Uri.parse(item.location.uri).fsPath);
        const classPaths: string[] = [...await resolveRuntimeClassPath(testPaths), await runner.runnerJarFilePath, await runner.runnerLibPath];

        let env: {} = process.env;
        if (config && config.env) {
            env = {...env, ...config.env};
        }

        return {
            name: 'Launch Java Tests',
            type: 'java',
            request: 'launch',
            mainClass: runner.runnerMainClassName,
            projectName: tests[0].project,
            cwd: config ? config.workingDirectory : undefined,
            classPaths,
            args: runner.getApplicationArgs(config),
            vmArgs: runner.getVmArgs(config),
            encoding: getJavaEncoding(Uri.parse(tests[0].location.uri), config),
            env,
            noDebug: !runnerContext.isDebug,
        };
    }
}

export async function getDebugConfigurationForEclispeRunner(test: ITestItem, socketPort: number, runnerContext: IRunnerContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    const junitLaunchArgs: IJUnitLaunchArguments = await getJUnitLaunchArguments(test, runnerContext);
    junitLaunchArgs.programArguments.push('-port', `${socketPort}`);
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
        encoding: getJavaEncoding(Uri.parse(test.location.uri)),
        env,
        console: 'internalConsole',
        noDebug: !runnerContext.isDebug,
    };
}

async function getJUnitLaunchArguments(test: ITestItem, runnerContext: IRunnerContext): Promise<IJUnitLaunchArguments> {
    let className: string = '';
    let methodName: string = '';

    const nameArray: string[] = runnerContext.fullName.split('#');
    className = nameArray[0];
    if (nameArray.length > 1) {
        methodName = nameArray[1];
    }

    return await resolveJUnitLaunchArguments(runnerContext.testUri, className, methodName, runnerContext.projectName || test.project, runnerContext.runFromRoot);
}

export function getJavaEncoding(uri: Uri, config?: IExecutionConfig): string {
    const encoding: string = getEncodingFromTestConfig(config) || getEncodingFromSetting(uri);
    if (!iconv.encodingExists(encoding)) {
        logger.error(`Unsupported encoding: ${encoding}, fallback to UTF-8.`);
        return 'utf8';
    }
    return encoding;
}

function getEncodingFromTestConfig(config?: IExecutionConfig): string | undefined {
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

function getEncodingFromSetting(uri: Uri): string {
    let javaEncoding: string | null = null;
    // One runner will contain all tests in one workspace with the same test framework.
    const config: WorkspaceConfiguration = workspace.getConfiguration(undefined, uri);
    const languageConfig: {} | undefined = config.get('[java]');
    if (languageConfig != null) {
        javaEncoding = languageConfig['files.encoding'];
    }

    if (javaEncoding == null) {
        javaEncoding = config.get<string>('files.encoding', 'UTF-8');
    }
    return javaEncoding;
}

export interface IRunnerContext {
    runFromRoot: boolean;
    testUri: string;
    fullName: string;
    projectName: string;
    isDebug: boolean;
}
