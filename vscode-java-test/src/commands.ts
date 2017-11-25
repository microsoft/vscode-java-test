import * as vscode from 'vscode';

export namespace Commands {
    /**
     * Run test
     */
    export const JAVA_RUN_TEST_COMMAND = 'java.run.test';
    
    /**
     * Debug test
     */
    export const JAVA_DEBUG_TEST_COMMAND = 'java.debug.test';

    export const JAVA_TEST_SHOW_DETAILS = 'java.test.show.detail';

    export const JAVA_FETCH_TEST = 'vscode.java.test.fetch';

    export const JAVA_EXECUTE_WORKSPACE_COMMAND = "java.execute.workspaceCommand";

    export function executeJavaLanguageServerCommand(...rest) {
        // TODO: need to handle error and trace telemetry
        return vscode.commands.executeCommand(JAVA_EXECUTE_WORKSPACE_COMMAND, ...rest);
    }
}

export namespace Configs {
    export const JAVA_TEST_PORT = 5555;
}