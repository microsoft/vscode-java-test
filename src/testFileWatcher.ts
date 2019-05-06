// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, ExtensionContext, FileSystemWatcher, RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { ITestSourcePath } from './commands/testPathCommands';
import { explorerNodeManager } from './explorer/explorerNodeManager';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';
import { logger } from './logger/logger';
import { getTestSourcePaths } from './utils/commandUtils';

class TestFileWatcher {

    public async initialize(context: ExtensionContext): Promise<void> {
        if (workspace.workspaceFolders) {
            try {
                const sourcePaths: ITestSourcePath[] = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
                for (const sourcePath of sourcePaths) {
                    const pattern: RelativePattern = new RelativePattern(Uri.file(sourcePath.path).fsPath, '**/*.{[jJ][aA][vV][aA]}');
                    const watcher: FileSystemWatcher = workspace.createFileSystemWatcher(pattern, true /* ignoreCreateEvents */);
                    this.registerWatcherListeners(watcher, context.subscriptions);
                    context.subscriptions.push(watcher);
                }
            } catch (error) {
                logger.error('Failed to get the test paths', error);
                const watcher: FileSystemWatcher = workspace.createFileSystemWatcher('**/*.{[jJ][aA][vV][aA]}');
                this.registerWatcherListeners(watcher, context.subscriptions);
                context.subscriptions.push(watcher);
            }
        }

    }

    private registerWatcherListeners(watcher: FileSystemWatcher, disposables: Disposable[]): void {
        watcher.onDidChange((uri: Uri) => {
            const node: TestTreeNode | undefined = explorerNodeManager.getNode(uri.fsPath);
            testExplorer.refresh(node);
        }, null, disposables);

        watcher.onDidDelete((uri: Uri) => {
            explorerNodeManager.removeNode(uri.fsPath);
            testExplorer.refresh();
        }, null, disposables);
    }
}

export const testFileWatcher: TestFileWatcher = new TestFileWatcher();
