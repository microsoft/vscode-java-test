// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Disposable, ExtensionContext, window } from 'vscode';
import { initializeFromJsonFile, instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { select } from './commands/explorerSelect';
import { JavaTestRunnerCommands } from './constants/commands';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';

export async function activate(context: ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'));
    await instrumentOperation('activation', doActivate)(context);
}

export function deactivate(): void {
    // do nothing
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    testExplorer.initialize(context);
    context.subscriptions.push(
        window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.ClickExplorerNode, async (node: TestTreeNode) => await select(node)),
    );
    await commands.executeCommand('setContext', 'java.test.activated', true);
}

function instrumentAndRegisterCommand(name: string, cb: (...args: any[]) => any): Disposable {
    const instrumented: (...args: any[]) => any = instrumentOperation(name, async (_operationId: string, ...args: any[]) => await cb(...args));
    return commands.registerCommand(name, instrumented);
}
