// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, ExtensionContext, window } from 'vscode';
import { initializeFromJsonFile, instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { testExplorer } from './explorer/testExplorer';

export async function activate(context: ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'));
    await instrumentOperation('activation', doActivate)(context);
}

export function deactivate(): void {
    // do nothing
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    testExplorer.initialize(context);
    context.subscriptions.push(window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer));
    await commands.executeCommand('setContext', 'java.test.activated', true);
}
