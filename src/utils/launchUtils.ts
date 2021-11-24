// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { DebugConfiguration, TestItem } from 'vscode';
import { sendError } from 'vscode-extension-telemetry-wrapper';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { dataCache } from '../controller/testItemDataCache';
import { extensionContext } from '../extension';
import { IExecutionConfig } from '../runConfigs';
import { BaseRunner } from '../runners/baseRunner/BaseRunner';
import { IJUnitLaunchArguments } from '../runners/baseRunner/BaseRunner';
import { IRunTestContext, TestKind, TestLevel } from '../types';
import { executeJavaLanguageServerCommand } from './commandUtils';

export async function resolveLaunchConfigurationForRunner(runner: BaseRunner, testContext: IRunTestContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    const launchArguments: IJUnitLaunchArguments = await getLaunchArguments(testContext);

    if (config && config.vmArgs) {
        launchArguments.vmArguments.push(...config.vmArgs.filter(Boolean));
    } else if (config && config.vmargs) {
        launchArguments.vmArguments.push(...config.vmargs.filter(Boolean));
    }

    if (testContext.kind === TestKind.TestNG) {
        return {
            name: `Launch Java Tests - ${testContext.testItems[0].label}`,
            type: 'java',
            request: 'launch',
            mainClass: 'com.microsoft.java.test.runner.Launcher',
            projectName: launchArguments.projectName,
            cwd: config && config.workingDirectory ? config.workingDirectory : launchArguments.workingDirectory,
            classPaths: [
                ...config?.classPaths || [],
                ...launchArguments.classpath || [],
                path.join(extensionContext.extensionPath, 'server', 'com.microsoft.java.test.runner-jar-with-dependencies.jar'),
            ],
            modulePaths: [
                ...config?.modulePaths || [],
                ...launchArguments.modulepath || [],
            ],
            args: runner.getApplicationArgs(config),
            vmArgs: launchArguments.vmArguments,
            env: config?.env,
            envFile: config?.envFile,
            noDebug: !testContext.isDebug,
            sourcePaths: config?.sourcePaths,
            preLaunchTask: config?.preLaunchTask,
        };
    }

    return {
        name: `Launch Java Tests - ${testContext.testItems[0].label}`,
        type: 'java',
        request: 'launch',
        mainClass: launchArguments.mainClass,
        projectName: launchArguments.projectName,
        cwd: config && config.workingDirectory ? config.workingDirectory : launchArguments.workingDirectory,
        classPaths: [
            ...config?.classPaths || [],
            ...launchArguments.classpath || [],
        ],
        modulePaths: [
            ...config?.modulePaths || [],
            ...launchArguments.modulepath || [],
        ],
        args: launchArguments.programArguments,
        vmArgs: launchArguments.vmArguments,
        env: config?.env,
        envFile: config?.envFile,
        noDebug: !testContext.isDebug,
        sourcePaths: config?.sourcePaths,
        preLaunchTask: config?.preLaunchTask,
    };
}

async function getLaunchArguments(testContext: IRunTestContext): Promise<IJUnitLaunchArguments> {
    const testLevel: TestLevel | undefined = dataCache.get(testContext.testItems[0])?.testLevel;
    if (testLevel === undefined) {
        const error: Error = new Error('Failed to get the required metadata to run');
        sendError(error);
        throw error;
    }
    return await resolveJUnitLaunchArguments(
        testContext.projectName,
        testLevel,
        testContext.kind,
        getTestNames(testContext),
    );
}

function getTestNames(testContext: IRunTestContext): string[] {
    if (testContext.kind === TestKind.TestNG) {
        return testContext.testItems.map((item: TestItem) => {
            return dataCache.get(item)?.fullName;
        }).filter(Boolean) as string[];
    }

    if (dataCache.get(testContext.testItems[0])?.testLevel === TestLevel.Class) {
        return testContext.testItems.map((item: TestItem) => {
            return dataCache.get(item)?.fullName;
        }).filter(Boolean) as string[];
    }

    return testContext.testItems.map((item: TestItem) => {
        return dataCache.get(item)?.jdtHandler;
    }).filter(Boolean) as string[];
}

async function resolveJUnitLaunchArguments(projectName: string, testLevel: TestLevel, testKind: TestKind, testNames: string[]): Promise<IJUnitLaunchArguments> {
    const argument: IJUnitLaunchArguments | undefined = await executeJavaLanguageServerCommand<IJUnitLaunchArguments>(
        JavaTestRunnerDelegateCommands.RESOLVE_JUNIT_ARGUMENT, JSON.stringify({
            projectName,
            testLevel,
            testKind,
            testNames,
        }),
    );

    if (!argument) {
        const error: Error = new Error('Failed to parse the JUnit launch arguments');
        sendError(error);
        throw error;
    }

    return argument;
}
