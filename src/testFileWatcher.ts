// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { Disposable, FileSystemWatcher, RelativePattern, Uri, workspace } from 'vscode';
import { testExplorer } from './explorer/testExplorer';
import { isStandardServerReady } from './extension';
import { logger } from './logger/logger';
import { ITestItem, TestLevel } from './protocols';
import { testSourceProvider } from './provider/testSourceProvider';
import { testItemModel } from './testItemModel';
import { testResultManager } from './testResultManager';

class TestFileWatcher implements Disposable {

    private disposables: Disposable[] = [];
    private registerListenersDebounce: _.DebouncedFunc<() => Promise<void>> = _.debounce(this.registerListenersInternal, 2 * 1000 /*ms*/);

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
    }

    protected async registerListenersInternal(): Promise<void> {
        if (!isStandardServerReady()) {
            return;
        }
        this.dispose();
        try {
            const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern();
            for (const pattern of patterns) {
                const watcher: FileSystemWatcher = workspace.createFileSystemWatcher(pattern, true /* ignoreCreateEvents */);
                this.registerWatcherListeners(watcher);
                this.disposables.push(watcher);
            }
        } catch (error) {
            logger.error('Failed to get the test paths', error);
            const watcher: FileSystemWatcher = workspace.createFileSystemWatcher('**/*.java');
            this.registerWatcherListeners(watcher);
            this.disposables.push(watcher);
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
