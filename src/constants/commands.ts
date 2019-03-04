// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export namespace JavaLanguageServerCommands {
    export const EXECUTE_WORKSPACE_COMMAND: string = 'java.execute.workspaceCommand';
}

export namespace JavaTestRunnerDelegateCommands {
    export const GET_TEST_SOURCE_PATH: string = 'vscode.java.test.get.testpath';
    export const SEARCH_TEST_ITEMS: string = 'vscode.java.test.search.items';
    export const SEARCH_TEST_ITEMS_ALL: string = 'vscode.java.test.search.items.all';
    export const SEARCH_TEST_CODE_LENS: string = 'vscode.java.test.search.codelens';
    export const SEARCH_TEST_LOCATION: string = 'vscode.java.test.search.location';
    export const RESOLVE_RUNTIME_CLASSPATH: string = 'vscode.java.test.runtime.classpath';
    export const GET_PROJECT_INFO: string = 'vscode.java.test.project.info';
}

export namespace JavaTestRunnerCommands {
    export const OPEN_DOCUMENT: string = 'java.test.open.document';
    export const REFRESH_EXPLORER: string = 'java.test.explorer.refresh';
    export const RUN_TEST_FROM_CODELENS: string = 'java.test.run';
    export const DEBUG_TEST_FROM_CODELENS: string = 'java.test.debug';
    export const RUN_TEST_FROM_EXPLORER: string = 'java.test.explorer.run';
    export const DEBUG_TEST_FROM_EXPLORER: string = 'java.test.explorer.debug';
    export const RUN_TEST_WITH_CONFIG_FROM_EXPLORER: string = 'java.test.explorer.run.config';
    export const DEBUG_TEST_WITH_CONFIG_FROM_EXPLORER: string = 'java.test.explorer.debug.config';
    export const SHOW_TEST_REPORT: string = 'java.test.show.report';
    export const SHOW_TEST_OUTPUT: string = 'java.test.show.output';
    export const OPEN_TEST_LOG: string = 'java.test.open.log';
    export const JAVA_TEST_CANCEL: string = 'java.test.cancel';
}
