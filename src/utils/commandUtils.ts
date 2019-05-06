// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { commands } from 'vscode';
import { ITestSourcePath } from '../commands/testPathCommands';
import { JavaLanguageServerCommands, JavaTestRunnerDelegateCommands } from '../constants/commands';
import { logger } from '../logger/logger';
import { ILocation, ISearchTestItemParams, ITestItem } from '../protocols';

export async function getTestSourcePaths(uri: string[]): Promise<ITestSourcePath[]> {
    return await executeJavaLanguageServerCommand<ITestSourcePath[]>(
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

async function executeJavaLanguageServerCommand<T>(...rest: any[]): Promise<T | undefined> {
    try {
        return await commands.executeCommand<T>(JavaLanguageServerCommands.EXECUTE_WORKSPACE_COMMAND, ...rest);
    } catch (error) {
        logger.error(error.toString());
        throw error;
    }
}
