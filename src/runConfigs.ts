// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Configurations } from './constants';

export interface IExecutionConfig {
    /**
     * The name of the configuration item.
     * @since 0.14.0
     */
    name?: string;

    /**
     * The working directory when running the tests.
     * @since 0.14.0
     */
    workingDirectory?: string;

    /**
     * The classpaths defined in this setting will be appended to the resolved classpaths.
     * @since 0.33.0
     */
    classPaths?: string[]

     /**
      * The modulepaths defined in this setting will be appended to the resolved modulepaths
      * @since 0.33.0
      */
    modulePaths?: string[]

    /**
     * The command line arguments which will be passed to the test runner.
     * @since 0.14.0
     */
    args?: any[];

    /**
     * the extra options and system properties for the JVM.
     * It's deprecated, we should align with the debug launch configuration, which is 'vmArgs'.
     * @since 0.14.0
     */
    vmargs?: any[];

    /**
     * the extra options and system properties for the JVM.
     * @since 0.14.0
     */
    vmArgs?: any[];

    /**
     * The extra environment variables when running the tests.
     * @since 0.25.0
     */
    env?: { [key: string]: string; };

    /**
     * The absolute path to a file containing environment variable definitions.
     * @since 0.33.0
     */
    envFile?: string;

    /**
     * The extra source paths when debugging the tests
     * @since 0.22.4
     */
    sourcePaths?: string[];

    /**
     * The label of a task specified in tasks.json.
     * @since 0.33.0
     */
     preLaunchTask?: string;
}

export function getBuiltinConfig(): IExecutionConfig {
    return Object.assign({}, BUILTIN_CONFIG);
}

const BUILTIN_CONFIG: IExecutionConfig = {
    name: Configurations.BUILTIN_CONFIG_NAME,
    workingDirectory: '${workspaceFolder}',
};
