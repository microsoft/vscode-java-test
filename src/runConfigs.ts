// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Configurations } from './constants';
import { IExecutionConfig } from './java-test-runner.api';

export function getBuiltinConfig(): IExecutionConfig {
    return Object.assign({}, BUILTIN_CONFIG);
}

const BUILTIN_CONFIG: IExecutionConfig = {
    name: Configurations.BUILTIN_CONFIG_NAME,
    workingDirectory: '${workspaceFolder}',
};
