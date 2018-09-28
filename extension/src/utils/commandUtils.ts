// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands } from 'vscode';
import { JavaLanguageServerCommands, JavaTestRunnerDelegateCommands } from '../constants/commands';
import { ISearchChildrenNodeRequest, ITestItem } from '../protocols';

export async function searchTestItems(request: ISearchChildrenNodeRequest): Promise<ITestItem[]> {
    const entries: ITestItem[] | undefined = await executeJavaLanguageServerCommand<ITestItem[]>(
        JavaTestRunnerDelegateCommands.SearchTestItems, JSON.stringify(request));
    return entries || [];
}

function executeJavaLanguageServerCommand<T>(...rest: any[]): Thenable<T | undefined> {
    return commands.executeCommand<T>(JavaLanguageServerCommands.ExecuteWorkspaceCommand, ...rest);
}
