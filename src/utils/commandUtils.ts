// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, commands, Position } from 'vscode';
import { JavaLanguageServerCommands, JavaTestRunnerDelegateCommands } from '../constants/commands';
import { logger } from '../logger/logger';
import { ILocation, ISearchTestItemParams, ITestItem, TestKind, TestLevel } from '../protocols';
import { IJUnitLaunchArguments } from '../runners/baseRunner/BaseRunner';

export async function getTestSourcePaths(uri: string[]): Promise<string[]> {
    return await executeJavaLanguageServerCommand<string[]>(
        JavaTestRunnerDelegateCommands.GET_TEST_SOURCE_PATH, uri) || [];
}

export async function searchTestItems(params: ISearchTestItemParams): Promise<ITestItem[]> {
    return await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_ITEMS, JSON.stringify(params)) || [];
}

export async function searchTestItemsAll(request: ISearchTestItemParams, token: CancellationToken): Promise<ITestItem[]> {
    return await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_ITEMS_ALL, JSON.stringify(request), token) || [];
}

export async function searchTestCodeLens(uri: string, token?: CancellationToken): Promise<ITestItem[]> {
    if (token) {
        return await executeJavaLanguageServerCommand<ITestItem[]>(
            JavaTestRunnerDelegateCommands.SEARCH_TEST_CODE_LENS, uri, token) || [];
    }
    return await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_CODE_LENS, uri) || [];
}

export async function searchTestLocation(fullName: string): Promise<ILocation[]> {
    return await executeJavaLanguageServerCommand<ILocation[]>(
        JavaTestRunnerDelegateCommands.SEARCH_TEST_LOCATION, fullName) || [];
}

export async function resolveJUnitLaunchArguments(uri: string, classFullName: string, testName: string, project: string,
                                                  scope: TestLevel, testKind: TestKind, start?: Position, end?: Position): Promise<IJUnitLaunchArguments> {
    const argument: IJUnitLaunchArguments | undefined = await executeJavaLanguageServerCommand<IJUnitLaunchArguments>(
        JavaTestRunnerDelegateCommands.RESOLVE_JUNIT_ARGUMENT, JSON.stringify({
            uri,
            classFullName,
            testName,
            project,
            scope,
            testKind,
            start,
            end,
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
