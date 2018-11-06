// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export namespace JavaLanguageServerCommands {
    export const EXECUTE_WORKSPACE_COMMAND: string = 'java.execute.workspaceCommand';
}

export namespace JavaTestRunnerDelegateCommands {
    export const SEARCH_TEST_ITEMS: string = 'vscode.java.test.search.items';
    export const SEARCH_TEST_CODE_LENS: string = 'vscode.java.test.search.codelens';
    export const RESOLVE_RUNTIME_CLASSPATH: string = 'vscode.java.test.runtime.classpath';
    export const GET_PROJECT_INFO: string = 'vscode.java.test.project.info';
}

export namespace JavaTestRunnerCommands {
    export const OPEN_DOCUMENT_FOR_NODE: string = 'java.test.explorer.select';
    export const REFRESH_EXPLORER: string = 'java.test.explorer.refresh';
    export const RUN_TEST_FROM_CODELENS: string = 'java.test.run';
    export const DEBUG_TEST_FROM_CODELENS: string = 'java.test.debug';
}
