// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from 'vscode';

/**
 * Run test
 */
export const JAVA_RUN_TEST_COMMAND = 'java.test.run';

/**
 * Debug test
 */
export const JAVA_DEBUG_TEST_COMMAND = 'java.test.debug';

export const JAVA_TEST_SHOW_DETAILS = 'java.test.show.detail';

export const JAVA_TEST_EXPLORER_SELECT = 'java.test.explorer.select';

export const JAVA_FETCH_TEST = 'vscode.java.test.fetch';

export const JAVA_SEARCH_ALL_TESTS = 'vscode.java.test.search.all';

export const JAVA_CALCULATE_CLASS_PATH = 'vscode.java.test.runtime.classpath';

export const JAVA_EXECUTE_WORKSPACE_COMMAND = "java.execute.workspaceCommand";

export function executeJavaLanguageServerCommand(...rest) {
    // TODO: need to handle error and trace telemetry
    return vscode.commands.executeCommand(JAVA_EXECUTE_WORKSPACE_COMMAND, ...rest);
}
