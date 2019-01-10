// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export interface IExecutionConfig {
    name?: string;
    projectName?: string;
    workingDirectory?: string;
    args?: any[];
    vmargs?: any[];
    env?: { [key: string]: string; };
    preLaunchTask?: string;
}

export interface IExecutionConfigGroup {
    default: string;
    items: IExecutionConfig[];
}

export interface ITestConfig {
    run: IExecutionConfigGroup;
    debug: IExecutionConfigGroup;
}

export const __EMPTY_CONFIG__: IExecutionConfig = {
    name: '__EMPTY_CONFIG__',
    workingDirectory: '${workspaceFolder}',
};
