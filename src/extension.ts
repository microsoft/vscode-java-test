// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { commands, DebugConfiguration, Event, Extension, ExtensionContext, extensions, TestItem, TestRunProfileKind, TextDocument, TextDocumentChangeEvent, TextEditor, Uri, window, workspace, WorkspaceFoldersChangeEvent } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation, instrumentOperationAsVsCodeCommand } from 'vscode-extension-telemetry-wrapper';
import { navigateToTestOrTarget } from './commands/navigation/navigationCommands';
import { generateTests } from './commands/generationCommands';
import { runTestsFromJavaProjectExplorer } from './commands/projectExplorerCommands';
import { refreshExplorer, runTestsFromTestExplorer } from './commands/testExplorerCommands';
import { openStackTrace } from './commands/testReportCommands';
import { openLatestTestReport } from './commands/reportCommands';
import { Context, ExtensionName, JavaTestRunnerCommands, VSCodeCommands } from './constants';
import { createTestController, testController, watchers } from './controller/testController';
import { updateItemForDocument, updateItemForDocumentWithDebounce } from './controller/utils';
import { IProgressProvider } from './debugger.api';
import { initExpService } from './experimentationService';
import { disposeCodeActionProvider, registerTestCodeActionProvider } from './provider/codeActionProvider';
import { testSourceProvider } from './provider/testSourceProvider';
import { registerAskForChoiceCommand, registerAdvanceAskForChoice, registerAskForInputCommand } from './commands/askForOptionCommands';
import { enableTests } from './commands/testDependenciesCommands';
import { testRunnerService } from './controller/testRunnerService';
import { TestRunner } from './java-test-runner.api';
import { parsePartsFromTestId, parseTestIdFromParts } from './utils/testItemUtils';

export let extensionContext: ExtensionContext;
let componentsRegistered: boolean = false;

export async function activate(context: ExtensionContext): Promise<any> {
    extensionContext = context;
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'), { replacementOptions: [{
        lookup: /path must include project and resource name: \/.*/gi,
        replacementString: 'Path must include project and resource name: /<REDACT>',
    }]});
    await initExpService(context);
    await instrumentOperation('activation', doActivate)(context);
    return {
        registerTestProfile: (name: string, kind: TestRunProfileKind, runner: TestRunner) => {
            testRunnerService.registerTestRunner(name, kind, runner);
        },
        parseTestIdFromParts,
        parsePartsFromTestId,
    };
}

export async function deactivate(): Promise<void> {
    disposeCodeActionProvider();
    await disposeTelemetryWrapper();
    testController?.dispose();
    for (const disposable of watchers) {
        disposable.dispose();
    }
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    const javaLanguageSupport: Extension<any> | undefined = extensions.getExtension(ExtensionName.JAVA_LANGUAGE_SUPPORT);
    if (javaLanguageSupport?.isActive) {
        const extensionApi: any = javaLanguageSupport.exports;
        if (!extensionApi) {
            return;
        }

        if (extensionApi.serverMode === LanguageServerMode.LightWeight) {
            if (extensionApi.onDidServerModeChange) {
                const onDidServerModeChange: Event<string> = extensionApi.onDidServerModeChange;
                context.subscriptions.push(onDidServerModeChange(async (mode: string) => {
                    if (mode === LanguageServerMode.Standard) {
                        testSourceProvider.clear();
                        registerComponents(context);
                    }
                }));
            }
        } else {
            await extensionApi.serverReady();
            registerComponents(context);
        }

        if (extensionApi.onDidClasspathUpdate) {
            const onDidClasspathUpdate: Event<Uri> = extensionApi.onDidClasspathUpdate;
            context.subscriptions.push(onDidClasspathUpdate(async () => {
                // workaround: wait more time to make sure Language Server has updated all caches
                setTimeout(() => {
                    testSourceProvider.clear();
                    refreshExplorer();
                }, 1000 /* ms */);
            }));
        }

        if (extensionApi.onDidProjectsImport) {
            const onDidProjectsImport: Event<Uri[]> = extensionApi.onDidProjectsImport;
            context.subscriptions.push(onDidProjectsImport(async () => {
                testSourceProvider.clear();
                refreshExplorer();
            }));
        }
    }

    const javaDebugger: Extension<any> | undefined = extensions.getExtension(ExtensionName.JAVA_DEBUGGER);
    if (javaDebugger?.isActive) {
        progressProvider = javaDebugger.exports?.progressProvider;
    }
}

function registerComponents(context: ExtensionContext): void {
    if (componentsRegistered) {
        return;
    }
    componentsRegistered = true;
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
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_JAVA_PROJECT_EXPLORER, async (node: any) => await runTestsFromJavaProjectExplorer(node, false /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_JAVA_PROJECT_EXPLORER, async (node: any) => await runTestsFromJavaProjectExplorer(node, true /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.GO_TO_TEST, async () => await navigateToTestOrTarget(true)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.GO_TO_TEST_SUBJECT, async () => await navigateToTestOrTarget(false)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.ENABLE_TESTS, async () => await enableTests()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.OPEN_TEST_REPORT, async () => await openLatestTestReport()),
        window.onDidChangeActiveTextEditor(async (e: TextEditor | undefined) => {
            if (await isTestJavaFile(e?.document)) {
                await updateItemForDocumentWithDebounce(e!.document.uri);
            }
        }),
        workspace.onDidChangeTextDocument(async (e: TextDocumentChangeEvent) => {
            if (await isTestJavaFile(e.document)) {
                await updateItemForDocumentWithDebounce(e.document.uri);
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
                createTestController();
            }, 1000);
        }),
    );

    registerTestCodeActionProvider();
    createTestController();
    showTestItemsInCurrentFile();
    commands.executeCommand('setContext', Context.ACTIVATION_CONTEXT_KEY, true);
}

async function isTestJavaFile(document: TextDocument | undefined): Promise<boolean> {
    if (!document?.uri || !isJavaFile(document)) {
        return false;
    }

    if (!await testSourceProvider.isOnTestSourcePath(document.uri)) {
        return false;
    }

    return true;
}

export async function showTestItemsInCurrentFile(): Promise<void> {
    if (await isTestJavaFile(window.activeTextEditor?.document)) {
        // we didn't call the debounced version to avoid first call takes a long time and expand too much
        // for the debounce window. (cpu resources are limited during activation)
        await updateItemForDocument(window.activeTextEditor!.document.uri);
    }
}

const enum LanguageServerMode {
    LightWeight = 'LightWeight',
    Standard = 'Standard',
    Hybrid = 'Hybrid',
}

export let progressProvider: IProgressProvider | undefined;

function isJavaFile(document: TextDocument): boolean {
    return path.extname(document.fileName) === '.java';
}
