// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export namespace JavaLanguageServerCommands {
    export const EXECUTE_WORKSPACE_COMMAND: string = 'java.execute.workspaceCommand';
    export const RESOLVE_STACKTRACE_LOCATION: string = 'java.project.resolveStackTraceLocation';
}

export namespace JavaTestRunnerDelegateCommands {
    export const GET_TEST_SOURCE_PATH: string = 'vscode.java.test.get.testpath';
    export const RESOLVE_JUNIT_ARGUMENT: string = 'vscode.java.test.junit.argument';
    export const GENERATE_TESTS: string = 'vscode.java.test.generateTests';
    export const FIND_JAVA_PROJECTS: string = 'vscode.java.test.findJavaProjects';
    export const FIND_TEST_PACKAGES_AND_TYPES: string = 'vscode.java.test.findTestPackagesAndTypes';
    export const FIND_DIRECT_CHILDREN_FOR_CLASS: string = 'vscode.java.test.findDirectTestChildrenForClass';
    export const FIND_TEST_TYPES_AND_METHODS: string = 'vscode.java.test.findTestTypesAndMethods';
    export const RESOLVE_PATH: string = 'vscode.java.test.resolvePath';
    export const NAVIGATE_TO_TEST_OR_TARGET: string = 'vscode.java.test.navigateToTestOrTarget';
}

export namespace JavaTestRunnerCommands {
    export const RUN_TEST_FROM_EDITOR: string = 'java.test.editor.run';
    export const DEBUG_TEST_FROM_EDITOR: string = 'java.test.editor.debug';
    export const RUN_TEST_FROM_JAVA_PROJECT_EXPLORER: string = 'java.test.runFromJavaProjectExplorer';
    export const DEBUG_TEST_FROM_JAVA_PROJECT_EXPLORER: string = 'java.test.debugFromJavaProjectExplorer';
    export const RUN_FROM_TEST_EXPLORER: string = 'java.test.explorer.run';
    export const DEBUG_FROM_TEST_EXPLORER: string = 'java.test.explorer.debug';
    export const REFRESH_TEST_EXPLORER: string = 'java.test.refreshExplorer';
    export const JAVA_TEST_GENERATE_TESTS: string = 'java.test.generateTests';
    export const FIND_TEST_LOCATION: string = 'vscode.java.test.findTestLocation';
    export const GO_TO_TEST: string = 'java.test.goToTest';
    export const GO_TO_TEST_SUBJECT: string = 'java.test.goToTestSubject';
    export const JAVA_TEST_OPEN_STACKTRACE: string = '_java.test.openStackTrace';
    export const ASK_CLIENT_FOR_CHOICE: string = '_java.test.askClientForChoice';
    export const ASK_CLIENT_FOR_INPUT: string = '_java.test.askClientForInput';
    export const ADVANCED_ASK_CLIENT_FOR_CHOICE: string = '_java.test.advancedAskClientForChoice';
}

export namespace VSCodeCommands {
    export const RUN_TESTS_IN_CURRENT_FILE: string = 'testing.runCurrentFile';
    export const DEBUG_TESTS_IN_CURRENT_FILE: string = 'testing.debugCurrentFile';
    export const WORKBENCH_ACTION_QUICK_OPEN: string = 'workbench.action.quickOpen';
}

export namespace Configurations {
    export const LOCAL_HOST: string = '127.0.0.1';
    export const DEFAULT_CONFIG_NAME_SETTING_KEY: string = 'java.test.defaultConfig';
    export const CONFIG_SETTING_KEY: string = 'java.test.config';
    export const BUILTIN_CONFIG_NAME: string = 'default';
    export const HINT_FOR_DEFAULT_CONFIG_SETTING_KEY: string = 'java.test.message.hintForSettingDefaultConfig';
}

export namespace Dialog {
    export const NEVER_SHOW: string = 'Never Show again';
    export const YES: string = 'Yes';
    export const NO: string = 'No';
}

export namespace ExtensionName {
    export const JAVA_DEBUGGER: string = 'vscjava.vscode-java-debug';
    export const JAVA_LANGUAGE_SUPPORT: string = 'redhat.java';
}

export namespace Context {
    export const ACTIVATION_CONTEXT_KEY: string = 'java:testRunnerActivated';
}

/**
 * This is the prefix of the invocation test item's id.
 * Invocation test items are created during test run.
 * For example, the invocations from a parameterized test.
 */
export const INVOCATION_PREFIX: string = '[__INVOCATION__]-';
