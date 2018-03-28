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

export const JAVA_RUN_WITH_CONFIG_COMMAND = 'java.test.run.config';

export const JAVA_DEBUG_WITH_CONFIG_COMMAND = 'java.test.debug.config';

export const JAVA_TEST_SHOW_REPORT = 'java.test.show.report';

export const JAVA_TEST_EXPLORER_SELECT = 'java.test.explorer.select';

export const JAVA_TEST_EXPLORER_RUN_TEST = 'java.test.explorer.run';

export const JAVA_TEST_EXPLORER_DEBUG_TEST = 'java.test.explorer.debug';

export const JAVA_TEST_EXPLORER_RUN_TEST_WITH_CONFIG = 'java.test.explorer.run.config';

export const JAVA_TEST_EXPLORER_DEBUG_TEST_WITH_CONFIG = 'java.test.explorer.debug.config';

export const JAVA_TEST_SHOW_OUTPUT = 'java.test.show.output';

export const JAVA_TEST_OPEN_LOG = 'java.test.open.log';

export const JAVA_CONFIGURE_TEST_COMMAND = 'java.test.configure';

export const JAVA_FETCH_TEST = 'vscode.java.test.fetch';

export const JAVA_SEARCH_ALL_TESTS = 'vscode.java.test.search.all';

export const JAVA_CALCULATE_CLASS_PATH = 'vscode.java.test.runtime.classpath';

export const JAVA_GET_PROJECT_INFO = 'vscode.java.test.project.info';

export const JAVA_EXECUTE_WORKSPACE_COMMAND = 'java.execute.workspaceCommand';

export function executeJavaLanguageServerCommand(...rest) {
    // TODO: need to handle error and trace telemetry
    return vscode.commands.executeCommand(JAVA_EXECUTE_WORKSPACE_COMMAND, ...rest);
}
