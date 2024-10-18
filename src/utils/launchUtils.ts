// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as os from 'os';
import { DebugConfiguration, TestItem, TestRunProfileKind } from 'vscode';
import { sendError, sendInfo } from 'vscode-extension-telemetry-wrapper';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { dataCache } from '../controller/testItemDataCache';
import { extensionContext } from '../extension';
import { BaseRunner, IJUnitLaunchArguments, Response } from '../runners/baseRunner/BaseRunner';
import { executeJavaLanguageServerCommand } from './commandUtils';
import { getJacocoAgentPath, getJacocoDataFilePath } from './coverageUtils';
import { IExecutionConfig, IRunTestContext, TestKind, TestLevel } from '../java-test-runner.api';

export async function resolveLaunchConfigurationForRunner(runner: BaseRunner, testContext: IRunTestContext, config?: IExecutionConfig): Promise<DebugConfiguration> {
    const launchArguments: IJUnitLaunchArguments = await getLaunchArguments(testContext);

    if (config && config.vmArgs) {
        launchArguments.vmArguments.push(...config.vmArgs.filter(Boolean));
    }

    let debugConfiguration: DebugConfiguration = {
        name: `Launch Java Tests - ${testContext.testItems[0].label}`,
        type: 'java',
        request: 'launch',
        projectName: launchArguments.projectName,
        cwd: config && config.workingDirectory ? config.workingDirectory : launchArguments.workingDirectory,
        modulePaths: [
            ...config?.modulePaths || [],
            ...launchArguments.modulepath || [],
        ],
        encoding: config?.encoding,
        vmArgs: launchArguments.vmArguments,
        env: config?.env,
        envFile: config?.envFile,
        noDebug: !testContext.isDebug,
        sourcePaths: config?.sourcePaths,
        preLaunchTask: config?.preLaunchTask,
        postDebugTask: config?.postDebugTask,
        javaExec: config?.javaExec,
    };

    if (testContext.kind === TestKind.TestNG) {
        debugConfiguration = Object.assign(debugConfiguration, {
            mainClass: 'com.microsoft.java.test.runner.Launcher',
            classPaths: [
                ...config?.classPaths || [],
                ...launchArguments.classpath || [],
                path.join(extensionContext.extensionPath, 'server', 'com.microsoft.java.test.runner-jar-with-dependencies.jar'),
            ],
            args: runner.getApplicationArgs(config),
        });
    } else {
        debugConfiguration = Object.assign(debugConfiguration, {
            mainClass: launchArguments.mainClass,
            classPaths: [
                ...config?.classPaths || [],
                ...launchArguments.classpath || [],
            ],
            args: [
                ...launchArguments.programArguments,
                ...(testContext.kind === TestKind.JUnit5 ? parseTags(config) : [])
            ],
        });
    }

    if (testContext.profile?.kind === TestRunProfileKind.Coverage) {
        let agentArg: string = `-javaagent:${getJacocoAgentPath(debugConfiguration)}=destfile=${getJacocoDataFilePath(launchArguments.projectName)}`;
        if (config?.coverage?.appendResult === false) {
            agentArg += ',append=false';
        }
        if (os.platform() === 'win32') {
            agentArg = `"${agentArg}"`;
        }
        (debugConfiguration.vmArgs as string[]).push(agentArg);
    }

    return debugConfiguration;
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
    const argument: Response<IJUnitLaunchArguments> | undefined = await executeJavaLanguageServerCommand<Response<IJUnitLaunchArguments>>(
        JavaTestRunnerDelegateCommands.RESOLVE_JUNIT_ARGUMENT, JSON.stringify({
            projectName,
            testLevel,
            testKind,
            testNames,
            uniqueId
        }),
    );

    if (!argument?.body || argument.errorMessage) {
        const error: Error = new Error(argument?.errorMessage || 'Failed to parse the JUnit launch arguments');
        sendError(error);
        throw error;
    }

    return argument.body;
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

// eslint-disable-next-line @typescript-eslint/typedef
export const exportedForTesting = {
    parseTags
}
