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
     * The path to java executable to use. If undefined project JDK's java executable is used.
     * @since 0.40.0
     */
    javaExec?: string;

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

    /**
     * The label of a task specified in tasks.json.
     * @since 0.39.0
     */
    postDebugTask?: string;

    /**
     * the test framework kind of this test configuration.
     * @since 0.37.0
     */
    testKind?: string;

    /**
     * The configurations for test filters.
     * @since 0.37.0
     */
    filters?: {
        /**
         * The test tags which will be included or excluded when running tests.
         * This field will only take effect on JUnit 5 tests and user needs to
         * explicitly set `testKind` to `junit`.
         * @since 0.37.0
         */
        tags?: string[]
    };

    /**
     * The coverage configuration.
     * @since 0.41.0
     */
    coverage?: {
        /**
         * Whether the coverage result is appended. For Jacoco, it means the execution data
         * is appended to the existing data file if it already exists.
         * @since 0.41.0
         */
        appendResult?: boolean;
    }

    /**
     * The when clause for matching tests by to determine if the configuration should be run with.
     * @since 0.41.0
     */
    when?: string
}

export function getBuiltinConfig(): IExecutionConfig {
    return Object.assign({}, BUILTIN_CONFIG);
}

const BUILTIN_CONFIG: IExecutionConfig = {
    name: Configurations.BUILTIN_CONFIG_NAME,
    workingDirectory: '${workspaceFolder}',
};
