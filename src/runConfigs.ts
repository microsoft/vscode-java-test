// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { BUILTIN_CONFIG_NAME } from './constants/configs';

export interface IExecutionConfig {
    name?: string;
    workingDirectory?: string;
    args?: any[];
    // deprecated, we should align with the debug launch configuration, which is 'vmArgs'
    vmargs?: any[];
    vmArgs?: any[];
    env?: { [key: string]: string; };
    sourcePaths?: string[];
}

export interface IExecutionConfigGroup {
    default: string;
    items: IExecutionConfig[];
}

export interface ITestConfig {
    run: IExecutionConfigGroup;
    debug: IExecutionConfigGroup;
}

export function getBuiltinConfig(): IExecutionConfig {
    return Object.assign({}, BUILTIN_CONFIG);
}

const BUILTIN_CONFIG: IExecutionConfig = {
    name: BUILTIN_CONFIG_NAME,
    workingDirectory: '${workspaceFolder}',
};
