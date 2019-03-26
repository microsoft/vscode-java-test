// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BUILTIN_CONFIG_NAME } from './constants/configs';

export interface IExecutionConfig {
    name?: string;
    workingDirectory?: string;
    args?: any[];
    vmargs?: any[];
    env?: { [key: string]: string; };
}

export interface IExecutionConfigGroup {
    default: string;
    items: IExecutionConfig[];
}

export interface ITestConfig {
    run: IExecutionConfigGroup;
    debug: IExecutionConfigGroup;
}

export const __BUILTIN_CONFIG__: IExecutionConfig = {
    name: BUILTIN_CONFIG_NAME,
    workingDirectory: '${workspaceFolder}',
};
