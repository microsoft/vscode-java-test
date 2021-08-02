// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Configurations } from './constants';

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

export function getBuiltinConfig(): IExecutionConfig {
    return Object.assign({}, BUILTIN_CONFIG);
}

const BUILTIN_CONFIG: IExecutionConfig = {
    name: Configurations.BUILTIN_CONFIG_NAME,
    workingDirectory: '${workspaceFolder}',
};
