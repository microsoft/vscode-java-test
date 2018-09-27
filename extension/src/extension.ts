// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, ExtensionContext, window } from 'vscode';
import { testExplorer } from './explorer/testExplorer';

export async function activate(context: ExtensionContext): Promise<void> {
    testExplorer.context = context;
    context.subscriptions.push(window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer));
    await commands.executeCommand('setContext', 'java.test.activated', true);
}

export function deactivate(): void {
    // do nothing
}
