// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from 'vscode';

/**
 * @todo Proposed API
 * Register a test profile to the test runner service.
 */
export type registerTestProfile = (name: string, kind: vscode.TestRunProfileKind, runner: TestRunner) => void;

/**
 * @todo Proposed API
 * Parse the test id from the parts.
 */
export type parseTestIdFromParts = (parts: TestIdParts) => string;

/**
 * @todo Proposed API
 * Parse the test id parts from the id.
 */
export type parsePartsFromTestId = (id: string) => TestIdParts;


/**
 * @todo Proposed API
 * The parts that compose a test id.
 */
export interface TestIdParts {
    /**
     * The project name.
     */
    project: string;

    /**
     * The package fully qualified name.
     */
    package?: string;

    /**
     * The class fully qualified name.
     */
    class?: string;

    /**
     * The method name or the invocation names(for example, the dynamic tests in JUnit Jupiter).
     */
    invocations?: string[];
}

/**
 * @todo Proposed API
 * The test runner.
 */
export interface TestRunner {
    /**
     * launch the test execution.
     * @param context the context for this test run.
     */
    launch(context: IRunTestContext): vscode.ProviderResult<void>;

    /**
     * Event that should be emitted when the status of a test item changes.
     */
    onDidChangeTestItemStatus: vscode.Event<TestItemStatusChangeEvent>;

    /**
     * Event that should be emitted when the test run is finished.
     */
    onDidFinishTestRun: vscode.Event<TestFinishEvent>;
}

/**
 * @todo Proposed API
 * The event that should be emitted when the status of a test item changes.
 */
export interface TestItemStatusChangeEvent {
    /**
     * An identifier representing the test item in the test explorer.
     * The identifier must follow the following format:
     * <package name>.<class name>[#<method or invocation name>]*
     *
     * Please note that:
     *
     * 1. The test controller will split the identifier to multiple parts according
     * to the above example, and find the target test item using this hierarchy in the test explorer.
     * 2. The class fully qualified name must be a valid one which exists in the test explorer.
     * 3. Only the last part of the invocation or method name of the item is allowed to be non-existent
     * in the explorer. In such case, the test controller will create a new test item in the test explorer.
     *
     * @example 'org.junit.Test#testMethod'
     * @example 'foo.bar#test(String, String)#1 + 1 = 2'
     */
    testId: string;

    /**
     * The new state of the test item.
     */
    state: TestResultState;

    /**
     * The display name of the test item which will be displayed as description in the test explorer.
     */
    displayName?: string;

    /**
     * The message of the test item. It can be used to show the error stacktrace for failed items.
     */
    message?: string;

    /**
     * Execution duration for this test item in milliseconds.
     */
    duration?: number;
}

/**
 * @todo Proposed API
 * The state of a test item.
 */
export enum TestResultState {
    /**
     * Test will be run, but is not currently running.
     */
    Queued = 1,

    /**
     * Test is currently running.
     */
    Running = 2,

    /**
     * Test run has passed.
     */
    Passed = 3,

    /**
     * Test run has failed (on an assertion).
     */
    Failed = 4,

    /**
     * Test run has been skipped.
     */
    Skipped = 5,

    /**
     * Test run failed for some other reason (compilation error, timeout, etc).
     */
    Errored = 6,
}

/**
 * @todo Proposed API
 * The event that should be emitted when the test run is finished.
 */
export interface TestFinishEvent {
    /**
     * The status of the test run.
     */
    statusCode: number;

    /**
     * The message of the test run.
     */
    message?: string;
}

/**
 * @todo Proposed API
 * The context for running tests.
 */
export interface IRunTestContext {
    /**
     * The flag to indicate whether the test run is in debug mode.
     */
    isDebug: boolean;

    /**
     * The kind of the test.
     */
    kind: TestKind;

    /**
     * The name of the project.
     */
    projectName: string;

    /**
     * The test items to run.
     */
    testItems: vscode.TestItem[];

    /**
     * VS Code's TestRun object for this test execution.
     */
    testRun: vscode.TestRun;

    /**
     * The workspace folder where the tests are run.
     */
    workspaceFolder: vscode.WorkspaceFolder;

    /**
     * The profile for this test run.
     */
    profile?: vscode.TestRunProfile;

    /**
     * The configuration for this test run.
     */
    testConfig?: IExecutionConfig;
}

/**
 * @todo Proposed API
 * The test kind.
 */
export enum TestKind {
    JUnit5 = 0,
    JUnit = 1,
    TestNG = 2,
    None = 100,
}

/**
 * @todo Proposed API
 * The test level.
 */
export enum TestLevel {
    Root = 0,
    Workspace = 1,
    WorkspaceFolder = 2,
    Project = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Invocation = 7,
}

/**
 * @todo Proposed API
 * The configuration for running tests.
 */
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
     * the default encoding the JVM will start with. If undefined, this will be UTF-8.
     * @since 0.43.0
     */
    encoding?: string;

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
