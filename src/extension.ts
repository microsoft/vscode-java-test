// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { commands, DebugConfiguration, Event, Extension, ExtensionContext, extensions, TestItem, TextDocument, TextDocumentChangeEvent, TextEditor, Uri, window, workspace } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation, instrumentOperationAsVsCodeCommand } from 'vscode-extension-telemetry-wrapper';
import { generateTests, registerAdvanceAskForChoice, registerAskForChoiceCommand, registerAskForInputCommand } from './commands/generationCommands';
import { refresh, runTestsFromTestExplorer } from './commands/testExplorerCommands';
import { openStackTrace } from './commands/testReportCommands';
import { Context, ExtensionName, JavaTestRunnerCommands, VSCodeCommands } from './constants';
import { createTestController, testController } from './controller/testController';
import { updateItemForDocument, updateItemForDocumentWithDebounce } from './controller/utils';
import { IProgressProvider } from './debugger.api';
import { initExpService } from './experimentationService';
import { disposeCodeActionProvider, registerTestCodeActionProvider } from './provider/codeActionProvider';
import { testSourceProvider } from './provider/testSourceProvider';

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
                testSourceProvider.clear();
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
                    testSourceProvider.clear();
                    registerTestCodeActionProvider();
                    createTestController();
                    await showTestItemsInCurrentFile();
                }
            }));
        }

        if (extensionApi.onDidProjectsImport) {
            const onDidProjectsImport: Event<Uri[]> = extensionApi.onDidProjectsImport;
            context.subscriptions.push(onDidProjectsImport(async () => {
                testSourceProvider.clear();
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

    context.subscriptions.push(
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_OPEN_STACKTRACE, openStackTrace),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EDITOR, async () => await commands.executeCommand(VSCodeCommands.RUN_TESTS_IN_CURRENT_FILE)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_EDITOR, async () => await commands.executeCommand(VSCodeCommands.DEBUG_TESTS_IN_CURRENT_FILE)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_GENERATE_TESTS, ((uri: Uri, startPosition: number) => generateTests(uri, startPosition))),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_FROM_TEST_EXPLORER, async (node: TestItem, launchConfiguration: DebugConfiguration) => await runTestsFromTestExplorer(node, launchConfiguration, false)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_FROM_TEST_EXPLORER, async (node: TestItem, launchConfiguration: DebugConfiguration) => await runTestsFromTestExplorer(node, launchConfiguration, false)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.REFRESH_TEST_EXPLORER, async () => await refresh()),
        window.onDidChangeActiveTextEditor(async (e: TextEditor | undefined) => {
            if (e?.document) {
                if (!isJavaFile(e.document)) {
                    return;
                }

                if (!await testSourceProvider.isOnTestSourcePath(e.document.uri)) {
                    return;
                }
                await updateItemForDocumentWithDebounce(e.document.uri);
            }
        }),
        workspace.onDidChangeTextDocument(async (e: TextDocumentChangeEvent) => {
            if (!isJavaFile(e.document)) {
                return;
            }
            if (!await testSourceProvider.isOnTestSourcePath(e.document.uri)) {
                return;
            }
            await updateItemForDocumentWithDebounce(e.document.uri);
        }),
    );

    if (isStandardServerReady()) {
        registerTestCodeActionProvider();
        createTestController();
    }

    await showTestItemsInCurrentFile();
}

async function showTestItemsInCurrentFile(): Promise<void> {
    if (window.activeTextEditor && isJavaFile(window.activeTextEditor.document) &&
            await testSourceProvider.isOnTestSourcePath(window.activeTextEditor.document.uri)) {
        // we didn't call the debounced version to avoid first call takes a long time and expand too much
        // for the debounce window. (cpu resources are limited during activation)
        await updateItemForDocument(window.activeTextEditor.document.uri);
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

function isJavaFile(document: TextDocument): boolean {
    return path.extname(document.fileName) === '.java';
}
