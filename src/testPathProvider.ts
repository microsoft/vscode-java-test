// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Uri, workspace, WorkspaceFolder } from 'vscode';
import { logger } from './logger/logger';
import { getTestSourcePaths } from './utils/commandUtils';

class TestPathProvider implements Disposable {

    private testPaths: Set<string> = new Set<string>();

    public async initialize(): Promise<void> {
        if (workspace.workspaceFolders) {
            try {
                const paths: string[] = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
                for (const path of paths) {
                    this.testPaths.add(Uri.file(path).fsPath);
                }
            } catch (error) {
                logger.error('Failed to get the test paths', error);
                for (const workspaceFolder of workspace.workspaceFolders) {
                    this.testPaths.add(workspaceFolder.uri.fsPath);
                }
            }
        }
    }

    public isInTestPaths(path: string): boolean {
        for (const testPath of this.testPaths) {
            if (path.startsWith(testPath)) {
                return true;
            }
        }
        return false;
    }

    public dispose(): void {
        this.testPaths.clear();
    }
}

export const testPathProvider: TestPathProvider = new TestPathProvider();
