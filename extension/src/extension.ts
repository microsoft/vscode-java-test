// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Disposable, ExtensionContext, FileSystemWatcher, languages, Uri, window, workspace } from 'vscode';
import { initializeFromJsonFile, instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { testCodeLensProvider } from './codeLensProvider';
import { openTextDocumentForNode } from './commands/explorerCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { explorerNodeManager } from './explorer/explorerNodeManager';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';
import { testResultManager } from './testResultManager';
import { testStatusBarProvider } from './testStatusBarProvider';

export async function activate(context: ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'));
    await instrumentOperation('activation', doActivate)(context);
}

export function deactivate(): void {
    // do nothing
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    testExplorer.initialize(context);
    testStatusBarProvider.show();
    const watcher: FileSystemWatcher = workspace.createFileSystemWatcher('**/*.{[jJ][aA][vV][aA]}');
    watcher.onDidChange((uri: Uri) => {
        const node: TestTreeNode | undefined = explorerNodeManager.getNode(uri.fsPath);
        if (node) {
            testExplorer.refresh(node);
        }
    });
    watcher.onDidDelete((uri: Uri) => {
        explorerNodeManager.removeNode(uri.fsPath);
        testExplorer.refresh();
    });
    watcher.onDidCreate(() => {
        testExplorer.refresh();
    });

    context.subscriptions.push(
        window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer),
        explorerNodeManager,
        testStatusBarProvider,
        testResultManager,
        watcher,
        languages.registerCodeLensProvider('java', testCodeLensProvider),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.OPEN_DOCUMENT_FOR_NODE, async (node: TestTreeNode) => await openTextDocumentForNode(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.REFRESH_EXPLORER, (node: TestTreeNode) => testExplorer.refresh(node)),
    );
    await commands.executeCommand('setContext', 'java.test.activated', true);
}

function instrumentAndRegisterCommand(name: string, cb: (...args: any[]) => any): Disposable {
    const instrumented: (...args: any[]) => any = instrumentOperation(name, async (_operationId: string, ...args: any[]) => await cb(...args));
    return commands.registerCommand(name, instrumented);
}
