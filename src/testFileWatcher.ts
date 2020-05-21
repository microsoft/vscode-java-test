// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { Disposable, FileSystemWatcher, RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { testCodeLensController } from './codelens/TestCodeLensController';
import { testExplorer } from './explorer/testExplorer';
import { logger } from './logger/logger';
import { ITestItem, TestLevel } from './protocols';
import { testItemModel } from './testItemModel';
import { testResultManager } from './testResultManager';
import { getTestSourcePaths } from './utils/commandUtils';

class TestFileWatcher implements Disposable {

    private patterns: RelativePattern[] = [];
    private disposables: Disposable[] = [];
    private registerListenersDebounce: (() => Promise<void>) & _.Cancelable = _.debounce(this.registerListenersInternal, 2 * 1000 /*ms*/);

    public async registerListeners(debounce: boolean = false): Promise<void> {
        if (debounce) {
            await this.registerListenersDebounce();
        } else {
            await this.registerListenersInternal();
        }
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            if (disposable) {
                disposable.dispose();
            }
        }
        this.disposables = [];
        this.patterns = [];
    }

    protected async registerListenersInternal(): Promise<void> {
        this.dispose();
        if (workspace.workspaceFolders) {
            try {
                const sourcePaths: string[] = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
                for (const sourcePath of sourcePaths) {
                    const normalizedPath: string = Uri.file(sourcePath).fsPath;
                    const pattern: RelativePattern = new RelativePattern(normalizedPath, '**/*.{[jJ][aA][vV][aA]}');
                    this.patterns.push(pattern);
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
            testCodeLensController.registerCodeLensProvider(this.patterns);
        }
    }

    private registerWatcherListeners(watcher: FileSystemWatcher): void {
        this.disposables.push(
            watcher.onDidChange((uri: Uri) => {
                const nodes: ITestItem[] = testItemModel.getItemsByFsPath(uri.fsPath);
                for (const node of nodes) {
                    if (node.level === TestLevel.Class) {
                        testExplorer.refresh(node);
                    }
                }
            }),

            watcher.onDidDelete((uri: Uri) => {
                const nodes: ITestItem[] = testItemModel.getItemsByFsPath(uri.fsPath);
                for (const node of nodes) {
                    testItemModel.removeTestItemById(node.id);
                    testResultManager.removeResultById(node.id);
                }
                testItemModel.removeIdMappingByFsPath(uri.fsPath);
                testExplorer.refresh();
            }),
        );
    }
}

export const testFileWatcher: TestFileWatcher = new TestFileWatcher();
