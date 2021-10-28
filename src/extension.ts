// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { commands, DebugConfiguration, Event, Extension, ExtensionContext, extensions, TestItem, TextDocument, TextDocumentChangeEvent, TextEditor, Uri, window, workspace, WorkspaceFoldersChangeEvent } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation, instrumentOperationAsVsCodeCommand } from 'vscode-extension-telemetry-wrapper';
import { generateTests, registerAdvanceAskForChoice, registerAskForChoiceCommand, registerAskForInputCommand } from './commands/generationCommands';
import { IProjectsExplorerTestRunner } from './commands/projectExplorerCommands';
import { ITestsExplorerTestRunner } from './commands/testExplorerCommands';
import { openStackTrace } from './commands/testReportCommands';
import { Context, ExtensionName, JavaTestRunnerCommands, VSCodeCommands } from './constants';
import { ITestController } from './controller/types';
import { updateItemForDocumentWithDebounce } from './controller/utils';
import { IProgressProvider } from './debugger.api';
import { initExpService } from './experimentationService';
import inversifyContainer from './inversify.config';
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
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    const testController: ITestController = inversifyContainer.get<ITestController>(ITestController);
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
                commands.executeCommand(JavaTestRunnerCommands.REFRESH_TEST_EXPLORER);
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
                    testController.refresh();
                }
            }));
        }

        if (extensionApi.onDidProjectsImport) {
            const onDidProjectsImport: Event<Uri[]> = extensionApi.onDidProjectsImport;
            context.subscriptions.push(onDidProjectsImport(async () => {
                testSourceProvider.clear();
                commands.executeCommand(JavaTestRunnerCommands.REFRESH_TEST_EXPLORER);
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

    // tslint:disable-next-line: typedef
    const a = inversifyContainer.get<IProjectsExplorerTestRunner>(IProjectsExplorerTestRunner)

    context.subscriptions.push(
        testController,
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_OPEN_STACKTRACE, openStackTrace),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EDITOR, async () => await commands.executeCommand(VSCodeCommands.RUN_TESTS_IN_CURRENT_FILE)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_EDITOR, async () => await commands.executeCommand(VSCodeCommands.DEBUG_TESTS_IN_CURRENT_FILE)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_GENERATE_TESTS, ((uri: Uri, startPosition: number) => generateTests(uri, startPosition))),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_FROM_TEST_EXPLORER, async (node: TestItem, launchConfiguration: DebugConfiguration) => await inversifyContainer.get<ITestsExplorerTestRunner>(ITestsExplorerTestRunner).runTests(node, launchConfiguration, false)),
        // instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_FROM_TEST_EXPLORER, async (node: TestItem, launchConfiguration: DebugConfiguration) => await runTestsFromTestExplorer(node, launchConfiguration, false)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.REFRESH_TEST_EXPLORER, async () => await testController.refresh()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_JAVA_PROJECT_EXPLORER, async (node: any) => await a.runTests(node, false /* isDebug */)),
        // instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_JAVA_PROJECT_EXPLORER, async (node: any) => await runTestsFromJavaProjectExplorer(node, true /* isDebug */)),
        window.onDidChangeActiveTextEditor(async (e: TextEditor | undefined) => {
            if (await isTestJavaFile(e?.document)) {
                await updateItemForDocumentWithDebounce(testController.getControllerImpl(), e!.document.uri);
            }
        }),
        workspace.onDidChangeTextDocument(async (e: TextDocumentChangeEvent) => {
            if (await isTestJavaFile(e.document)) {
                await updateItemForDocumentWithDebounce(testController.getControllerImpl(), e.document.uri);
            }
        }),
        workspace.onDidChangeWorkspaceFolders(async (e: WorkspaceFoldersChangeEvent) => {
            for (const deletedFolder of e.removed) {
                testSourceProvider.delete(deletedFolder.uri);
            }
            // workaround to wait for Java Language Server to accept the workspace folder change event,
            // otherwise we cannot find the projects in the new workspace folder.
            // TODO: this event should be notified by onDidProjectsImport, we need to fix upstream
            setTimeout(() => {
                testController.refresh();
            }, 1000);
        }),
    );

    if (isStandardServerReady()) {
        registerTestCodeActionProvider();
        testController.refresh();
    }
}

export async function isTestJavaFile(document: TextDocument | undefined): Promise<boolean> {
    if (!isStandardServerReady()) {
        return false;
    }

    if (!document?.uri || !isJavaFile(document)) {
        return false;
    }

    if (!await testSourceProvider.isOnTestSourcePath(document.uri)) {
        return false;
    }

    return true;
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

export function isJavaFile(document: TextDocument): boolean {
    return path.extname(document.fileName) === '.java';
}
