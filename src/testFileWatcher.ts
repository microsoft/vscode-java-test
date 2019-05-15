// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, FileSystemWatcher, RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { explorerNodeManager } from './explorer/explorerNodeManager';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';
import { logger } from './logger/logger';
import { getTestSourcePaths } from './utils/commandUtils';

class TestFileWatcher implements Disposable {

    private disposables: Disposable[] = [];

    public async registerListeners(): Promise<void> {
        this.dispose();
        if (workspace.workspaceFolders) {
            try {
                const sourcePaths: string[] = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
                for (const sourcePath of sourcePaths) {
                    const pattern: RelativePattern = new RelativePattern(Uri.file(sourcePath).fsPath, '**/*.{[jJ][aA][vV][aA]}');
                    const watcher: FileSystemWatcher = workspace.createFileSystemWatcher(pattern, true /* ignoreCreateEvents */);
                    this.registerWatcherListeners(watcher);
                    this.disposables.push(watcher);
                }
            } catch (error) {
                logger.error('Failed to get the test paths', error);
                const watcher: FileSystemWatcher = workspace.createFileSystemWatcher('**/*.{[jJ][aA][vV][aA]}');
                this.registerWatcherListeners(watcher);
                this.disposables.push(watcher);
            }
        }

    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            if (disposable) {
                disposable.dispose();
            }
        }
        this.disposables = [];
    }

    private registerWatcherListeners(watcher: FileSystemWatcher): void {
        this.disposables.push(
            watcher.onDidChange((uri: Uri) => {
                const node: TestTreeNode | undefined = explorerNodeManager.getNode(uri.fsPath);
                testExplorer.refresh(node);
            }),

            watcher.onDidDelete((uri: Uri) => {
                explorerNodeManager.removeNode(uri.fsPath);
                testExplorer.refresh();
            }),
        );
    }
}

export const testFileWatcher: TestFileWatcher = new TestFileWatcher();
