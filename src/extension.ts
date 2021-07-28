// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Event, Extension, ExtensionContext, extensions, Uri } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { registerAdvanceAskForChoice, registerAskForChoiceCommand, registerAskForInputCommand } from './commands/generationCommands';
import { Context, ExtensionName, VSCodeCommands } from './constants';
import { createTestController, testController } from './controller/testController';
import { IProgressProvider } from './debugger.api';
import { initExpService } from './experimentationService';
import { disposeCodeActionProvider, registerTestCodeActionProvider } from './provider/codeActionProvider';

export let extensionContext: ExtensionContext;

export async function activate(context: ExtensionContext): Promise<void> {
    extensionContext = context;
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'), { firstParty: true });
    await initExpService(context);
    await instrumentOperation('activation', doActivate)(context);
    await commands.executeCommand('setContext', Context.ACTIVATION_CONTEXT_KEY, true);
}

export async function deactivate(): Promise<void> {
    disposeCodeActionProvider();
    await disposeTelemetryWrapper();
    testController?.dispose();
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    const javaLanguageSupport: Extension<any> | undefined = extensions.getExtension(ExtensionName.JAVA_LANGUAGE_SUPPORT);
    if (javaLanguageSupport?.isActive) {
        const extensionApi: any = javaLanguageSupport.exports;
        if (!extensionApi) {
            return;
        }

        serverMode = extensionApi.serverMode;

        if (extensionApi.onDidClasspathUpdate) {
            const onDidClasspathUpdate: Event<Uri> = extensionApi.onDidClasspathUpdate;
            context.subscriptions.push(onDidClasspathUpdate(async () => {
                commands.executeCommand(VSCodeCommands.REFRESH_TESTS);
            }));
        }

        if (extensionApi.onDidServerModeChange) {
            const onDidServerModeChange: Event<string> = extensionApi.onDidServerModeChange;
            context.subscriptions.push(onDidServerModeChange(async (mode: string) => {
                if (serverMode === mode) {
                    return;
                }
                serverMode = mode;
                // Only re-initialize the component when its lightweight -> standard
                if (mode === LanguageServerMode.Standard) {
                    registerTestCodeActionProvider();
                    createTestController();
                }
            }));
        }

        if (extensionApi.onDidProjectsImport) {
            const onDidProjectsImport: Event<Uri[]> = extensionApi.onDidProjectsImport;
            context.subscriptions.push(onDidProjectsImport(async () => {
                commands.executeCommand(VSCodeCommands.REFRESH_TESTS);
            }));
        }
    }

    const javaDebugger: Extension<any> | undefined = extensions.getExtension(ExtensionName.JAVA_DEBUGGER);
    if (javaDebugger?.isActive) {
        progressProvider = javaDebugger.exports?.progressProvider;
    }

    registerAskForChoiceCommand(context);
    registerAdvanceAskForChoice(context);
    registerAskForInputCommand(context);

    if (isStandardServerReady()) {
        registerTestCodeActionProvider();
        createTestController();
    }
}

export function isStandardServerReady(): boolean {
    // undefined serverMode indicates an older version language server
    if (serverMode === undefined) {
        return true;
    }

    if (serverMode !== LanguageServerMode.Standard) {
        return false;
    }

    return true;
}

let serverMode: string | undefined;

const enum LanguageServerMode {
    LightWeight = 'LightWeight',
    Standard = 'Standard',
    Hybrid = 'Hybrid',
}

export let progressProvider: IProgressProvider | undefined;
