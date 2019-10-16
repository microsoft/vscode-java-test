// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as iconv from 'iconv-lite';
import { DebugConfiguration, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { logger } from '../logger/logger';
import { ITestItem, TestKind, TestLevel } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { BaseRunner } from '../runners/baseRunner/BaseRunner';
import { IJUnitLaunchArguments } from '../runners/baseRunner/BaseRunner';
import { IRunnerContext } from '../runners/models';
import { resolveJUnitLaunchArguments } from './commandUtils';
import { randomSequence } from './configUtils';

export async function resolveLaunchConfigurationForRunner(runner: BaseRunner, tests: ITestItem[], runnerContext: IRunnerContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    if (tests[0].kind === TestKind.TestNG) {
        const testNGArguments: IJUnitLaunchArguments = await getTestNGLaunchArguments(tests[0]);

        let env: {} = process.env;
        if (config && config.env) {
            env = {...env, ...config.env};
        }

        if (config && config.vmargs) {
            testNGArguments.vmArguments.push(...config.vmargs.filter(Boolean));
        }

        return {
            name: `Launch Java Tests - ${randomSequence()}`,
            type: 'java',
            request: 'launch',
            mainClass: runner.runnerMainClassName,
            projectName: tests[0].project,
            cwd: config ? config.workingDirectory : undefined,
            classPaths: [...testNGArguments.classpath, await runner.runnerJarFilePath, await runner.runnerLibPath],
            modulePaths: testNGArguments.modulepath,
            args: runner.getApplicationArgs(config),
            vmArgs: testNGArguments.vmArguments,
            encoding: getJavaEncoding(Uri.parse(tests[0].location.uri), config),
            env,
            console: 'internalConsole',
            noDebug: !runnerContext.isDebug,
        };
    }

    return await getDebugConfigurationForEclispeRunner(tests[0], runner.serverPort, runnerContext, config);
}

export async function getDebugConfigurationForEclispeRunner(test: ITestItem, socketPort: number, runnerContext: IRunnerContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    const junitLaunchArgs: IJUnitLaunchArguments = await getJUnitLaunchArguments(test, runnerContext);

    // We need to replace the socket port number since the socket is established from the client side.
    // The port number returned from the server side is a fake one.
    const portIndex: number = junitLaunchArgs.programArguments.indexOf('-port');
    if (portIndex > -1 && junitLaunchArgs.programArguments.length > portIndex + 1) {
        junitLaunchArgs.programArguments[portIndex + 1] = `${socketPort}`;
    }
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
        if (test.paramTypes.length > 0) {
            methodName = `${methodName}(${test.paramTypes.join(',')})`;
        }
    }

    return await resolveJUnitLaunchArguments(runnerContext.testUri, className, methodName, runnerContext.projectName || test.project, runnerContext.scope, test.kind);
}

async function getTestNGLaunchArguments(test: ITestItem): Promise<IJUnitLaunchArguments> {
    return await resolveJUnitLaunchArguments('', '', '', test.project, TestLevel.Root, test.kind);
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
