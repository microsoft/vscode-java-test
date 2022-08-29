// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { DebugConfiguration, TestItem } from 'vscode';
import { sendError, sendInfo } from 'vscode-extension-telemetry-wrapper';
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
        args: [
            ...launchArguments.programArguments,
            ...(testContext.kind === TestKind.JUnit5 ? parseTags(config) : [])
        ],
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

    // optional uniqueId in case we are re-running only a single invocation:
    const uniqueId: string | undefined = testContext.testItems.length === 1 ?
        dataCache.get(testContext.testItems[0])?.uniqueId : undefined;

    if (uniqueId) {
        sendInfo('', { runJunitInvocation: 'true' });
    }

    return await resolveJUnitLaunchArguments(
        testContext.projectName,
        testLevel,
        testContext.kind,
        getTestNames(testContext),
        uniqueId
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

async function resolveJUnitLaunchArguments(projectName: string, testLevel: TestLevel, testKind: TestKind, testNames: string[], uniqueId: string | undefined): Promise<IJUnitLaunchArguments> {
    const argument: IJUnitLaunchArguments | undefined = await executeJavaLanguageServerCommand<IJUnitLaunchArguments>(
        JavaTestRunnerDelegateCommands.RESOLVE_JUNIT_ARGUMENT, JSON.stringify({
            projectName,
            testLevel,
            testKind,
            testNames,
            uniqueId
        }),
    );

    if (!argument) {
        const error: Error = new Error('Failed to parse the JUnit launch arguments');
        sendError(error);
        throw error;
    }

    return argument;
}

/**
 * Parse the tags from the test configuration.
 */
function parseTags(config: IExecutionConfig | undefined): string[] {
    const tags: string[] = [];
    if (config?.testKind !== 'junit') {
        return tags;
    }

    if (config?.filters?.tags) {
        for (let tag of config.filters.tags) {
            tag = tag.trim();
            const isExcluded: boolean = tag.startsWith('!');
            if (isExcluded) {
                tag = tag.slice(1);
            }
            if (tag.length === 0) {
                continue;
            }

            if (isExcluded) {
                tags.push('--exclude-tag');
            } else {
                tags.push('--include-tag');
            }
            tags.push(tag);
        }
    }
    if (tags.length) {
        sendInfo('', {
            testFilters: 'tags'
        });
    }
    return tags;
}

// tslint:disable-next-line: typedef
export const exportedForTesting = {
    parseTags
}
