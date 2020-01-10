// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration } from 'vscode';
import { TestKind, TestLevel } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { BaseRunner } from '../runners/baseRunner/BaseRunner';
import { IJUnitLaunchArguments } from '../runners/baseRunner/BaseRunner';
import { IRunnerContext } from '../runners/models';
import { resolveJUnitLaunchArguments } from './commandUtils';
import { randomSequence } from './configUtils';

export async function resolveLaunchConfigurationForRunner(runner: BaseRunner, runnerContext: IRunnerContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    if (runnerContext.kind === TestKind.TestNG) {
        const testNGArguments: IJUnitLaunchArguments = await getTestNGLaunchArguments(runnerContext.projectName);

        let env: {} = {};
        if (config && config.env) {
            env = config.env;
        }

        if (config && config.vmargs) {
            testNGArguments.vmArguments.push(...config.vmargs.filter(Boolean));
        }

        return {
            name: `Launch Java Tests - ${randomSequence()}`,
            type: 'java',
            request: 'launch',
            mainClass: runner.runnerMainClassName,
            projectName: runnerContext.projectName,
            cwd: config && config.workingDirectory ? config.workingDirectory : testNGArguments.workingDirectory,
            classPaths: [...testNGArguments.classpath, await runner.runnerJarFilePath, await runner.runnerLibPath],
            modulePaths: testNGArguments.modulepath,
            args: runner.getApplicationArgs(config),
            vmArgs: testNGArguments.vmArguments,
            env,
            noDebug: !runnerContext.isDebug,
        };
    }

    return await getDebugConfigurationForEclispeRunner(runnerContext, config);
}

export async function getDebugConfigurationForEclispeRunner(runnerContext: IRunnerContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    const junitLaunchArgs: IJUnitLaunchArguments = await getJUnitLaunchArguments(runnerContext);

    if (config && config.vmargs) {
        junitLaunchArgs.vmArguments.push(...config.vmargs.filter(Boolean));
    }
    let env: {} = {};
    if (config && config.env) {
        env = config.env;
    }

    return {
        name: `Launch Java Tests - ${randomSequence()}`,
        type: 'java',
        request: 'launch',
        mainClass: junitLaunchArgs.mainClass,
        projectName: junitLaunchArgs.projectName,
        cwd: config && config.workingDirectory ? config.workingDirectory : junitLaunchArgs.workingDirectory,
        classPaths: junitLaunchArgs.classpath,
        modulePaths: junitLaunchArgs.modulepath,
        args: junitLaunchArgs.programArguments,
        vmArgs: junitLaunchArgs.vmArguments,
        env,
        noDebug: !runnerContext.isDebug,
    };
}

async function getJUnitLaunchArguments(runnerContext: IRunnerContext): Promise<IJUnitLaunchArguments> {
    let className: string = '';
    let methodName: string = '';

    const nameArray: string[] = runnerContext.fullName.split('#');
    className = nameArray[0];
    if (nameArray.length > 1) {
        methodName = nameArray[1];
        if (runnerContext.paramTypes.length > 0) {
            methodName = `${methodName}(${runnerContext.paramTypes.join(',')})`;
        }
    }

    return await resolveJUnitLaunchArguments(runnerContext.testUri, className, methodName, runnerContext.projectName, runnerContext.scope, runnerContext.kind);
}

async function getTestNGLaunchArguments(projectName: string): Promise<IJUnitLaunchArguments> {
    return await resolveJUnitLaunchArguments('', '', '', projectName, TestLevel.Root, TestKind.TestNG);
}
