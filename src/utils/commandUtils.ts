// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Uri } from 'vscode';
import { JavaLanguageServerCommands, JavaTestRunnerDelegateCommands } from '../constants/commands';
import { IProjectInfo, ISearchTestItemParams, ITestItem } from '../protocols';

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

export async function resolveRuntimeClassPath(paths: string[]): Promise<string[]> {
    return await executeJavaLanguageServerCommand<string[]>(
        JavaTestRunnerDelegateCommands.RESOLVE_RUNTIME_CLASSPATH, paths) || [];
}

export async function getProjectInfo(folderUri: Uri): Promise<IProjectInfo[]> {
    return await executeJavaLanguageServerCommand<IProjectInfo[]>(
        JavaTestRunnerDelegateCommands.GET_PROJECT_INFO, folderUri.toString()) || [];
}

function executeJavaLanguageServerCommand<T>(...rest: any[]): Thenable<T | undefined> {
    return commands.executeCommand<T>(JavaLanguageServerCommands.EXECUTE_WORKSPACE_COMMAND, ...rest);
}
