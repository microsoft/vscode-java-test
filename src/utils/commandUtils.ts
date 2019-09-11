// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { commands } from 'vscode';
import { JavaLanguageServerCommands, JavaTestRunnerDelegateCommands } from '../constants/commands';
import { logger } from '../logger/logger';
import { ILocation, ISearchTestItemParams, ITestItem } from '../protocols';
import { IJUnitLaunchArguments } from '../runners/junit4Runner/Junit4Runner';

export async function getTestSourcePaths(uri: string[]): Promise<string[]> {
    return await executeJavaLanguageServerCommand<string[]>(
        JavaTestRunnerDelegateCommands.GET_TEST_SOURCE_PATH, uri) || [];
}

export async function searchTestItems(params: ISearchTestItemParams): Promise<ITestItem[]> {
    return await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_ITEMS, JSON.stringify(params)) || [];
}

export async function searchTestItemsAll(request: ISearchTestItemParams): Promise<ITestItem[]> {
    return await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_ITEMS_ALL, JSON.stringify(request)) || [];
}

export async function searchTestCodeLens(uri: string): Promise<ITestItem[]> {
    return await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_CODE_LENS, uri) || [];
}

export async function searchTestLocation(fullName: string): Promise<ILocation[]> {
    return await executeJavaLanguageServerCommand<ILocation[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_LOCATION, fullName) || [];
}

export async function resolveRuntimeClassPath(paths: string[]): Promise<string[]> {
    return _.uniq(await executeJavaLanguageServerCommand<string[]>(
        JavaTestRunnerDelegateCommands.RESOLVE_RUNTIME_CLASSPATH, paths) || []);
}

export async function checkProjectSettings(className: string, projectName: string, inheritedOptions: boolean, expectedOptions: {[key: string]: string}): Promise<boolean> {
    return await executeJavaLanguageServerCommand<boolean>(
        JavaTestRunnerDelegateCommands.JAVA_CHECK_PROJECT_SETTINGS, JSON.stringify({
            className,
            projectName,
            inheritedOptions,
            expectedOptions,
        })) || false;
}

const COMPILER_PB_ENABLE_PREVIEW_FEATURES: string = 'org.eclipse.jdt.core.compiler.problem.enablePreviewFeatures';
export async function shouldEnablePreviewFlag(className: string, projectName: string): Promise<boolean> {
    const expectedOptions: { [x: string]: string; } = {
        [COMPILER_PB_ENABLE_PREVIEW_FEATURES]: 'enabled',
    };
    return await checkProjectSettings(className, projectName, true, expectedOptions);
}

export async function resolveJUnitLaunchArguments(uri: string, classFullName: string, testName: string, project: string, runFromRoot: boolean = false): Promise<IJUnitLaunchArguments> {
    const argument: IJUnitLaunchArguments | undefined = await executeJavaLanguageServerCommand<IJUnitLaunchArguments>(
        JavaTestRunnerDelegateCommands.RESOLVE_JUNIT_ARGUMENT, JSON.stringify({
            uri,
            classFullName,
            testName,
            project,
            runFromRoot,
        }));

    if (!argument) {
        throw new Error('Failed to parse the JUnit launch arguments');
    }

    return argument;
}

async function executeJavaLanguageServerCommand<T>(...rest: any[]): Promise<T | undefined> {
    try {
        return await commands.executeCommand<T>(JavaLanguageServerCommands.EXECUTE_WORKSPACE_COMMAND, ...rest);
    } catch (error) {
        logger.error(error.toString());
        throw error;
    }
}
