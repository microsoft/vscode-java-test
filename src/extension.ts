// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { commands, DebugConfiguration, Event, Extension, ExtensionContext, extensions, Range, Uri, window, workspace } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation, instrumentOperationAsVsCodeCommand } from 'vscode-extension-telemetry-wrapper';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { testCodeLensController } from './codelens/TestCodeLensController';
import { debugTestsFromExplorer, openTextDocument, runTestsFromExplorer } from './commands/explorerCommands';
import { openLogFile, showOutputChannel } from './commands/logCommands';
import { runFromCodeLens } from './commands/runFromCodeLens';
import { executeTestsFromUri } from './commands/runFromUri';
import { openStackTrace, openTestSourceLocation } from './commands/testReportCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { ACTIVATION_CONTEXT_KEY } from './constants/configs';
import { IProgressProvider, IProgressReporter } from './debugger.api';
import { testExplorer } from './explorer/testExplorer';
import { logger } from './logger/logger';
import { ITestItem } from './protocols';
import { ITestResult } from './runners/models';
import { runnerScheduler } from './runners/runnerScheduler';
import { testFileWatcher } from './testFileWatcher';
import { testItemModel } from './testItemModel';
import { testReportProvider } from './testReportProvider';
import { testResultManager } from './testResultManager';
import { testStatusBarProvider } from './testStatusBarProvider';
import { migrateTestConfig } from './utils/configUtils';

export async function activate(context: ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'), { firstParty: true });
    await instrumentOperation('activation', doActivate)(context);
    await commands.executeCommand('setContext', ACTIVATION_CONTEXT_KEY, true);
}

export async function deactivate(): Promise<void> {
    await disposeTelemetryWrapper();
    await runnerScheduler.cleanUp(false /* isCancel */);
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    const storagePath: string = context.storageUri?.fsPath || path.join(os.tmpdir(), 'java_test_runner');
    await fse.ensureDir(storagePath);
    logger.initialize(storagePath, context.subscriptions);

    const javaLanguageSupport: Extension<any> | undefined = extensions.getExtension('redhat.java');
    let javaLanguageSupportVersion: string = '0.0.0';
    if (javaLanguageSupport && javaLanguageSupport.isActive) {
        const extensionApi: any = javaLanguageSupport.exports;
        if (!extensionApi) {
            return;
        }

        serverMode = extensionApi.serverMode;

        if (extensionApi.onDidClasspathUpdate) {
            const onDidClasspathUpdate: Event<Uri> = extensionApi.onDidClasspathUpdate;
            context.subscriptions.push(onDidClasspathUpdate(async () => {
                await testFileWatcher.registerListeners(true /*enableDebounce*/);
            }));
        }

        if (extensionApi.onDidServerModeChange) {
            const onDidServerModeChange: Event<string> = extensionApi.onDidServerModeChange;
            context.subscriptions.push(onDidServerModeChange(async (mode: string) => {
                serverMode = mode;
                testExplorer.refresh();
                await testFileWatcher.registerListeners();
            }));
        }

        if (extensionApi.onDidProjectsImport) {
            const onDidProjectsImport: Event<Uri[]> = extensionApi.onDidProjectsImport;
            context.subscriptions.push(onDidProjectsImport(async () => {
                await testFileWatcher.registerListeners(true /*enableDebounce*/);
            }));
        }

        javaLanguageSupportVersion = javaLanguageSupport.packageJSON.version;
    }

    const javaDebugger: Extension<any> | undefined = extensions.getExtension('vscjava.vscode-java-debug');
    if (javaDebugger?.isActive) {
        progressProvider = javaDebugger.exports?.progressProvider;
    }

    await testFileWatcher.registerListeners();
    testExplorer.initialize(context);
    runnerScheduler.initialize(context);
    testReportProvider.initialize(context, javaLanguageSupportVersion);

    context.subscriptions.push(
        testExplorer,
        window.createTreeView(testExplorer.testExplorerViewId, { treeDataProvider: testExplorer, showCollapseAll: true }),
        testStatusBarProvider,
        testResultManager,
        testReportProvider,
        testFileWatcher,
        logger,
        testCodeLensController,
        testItemModel,
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.OPEN_DOCUMENT, async (uri: Uri, range?: Range) => await openTextDocument(uri, range)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.REFRESH_EXPLORER, (node: ITestItem) => testExplorer.refresh(node)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS, async (test: ITestItem) => await runFromCodeLens(test, false /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS, async (test: ITestItem) => await runFromCodeLens(test, true /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_ALL_TEST_FROM_EXPLORER, async () => await runTestsFromExplorer()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_ALL_TEST_FROM_EXPLORER, async () => await debugTestsFromExplorer()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EXPLORER, async (node?: ITestItem, launchConfiguration?: DebugConfiguration) => await runTestsFromExplorer(node, launchConfiguration)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_EXPLORER, async (node?: ITestItem, launchConfiguration?: DebugConfiguration) => await debugTestsFromExplorer(node, launchConfiguration)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RELAUNCH_TESTS, async () => await runnerScheduler.relaunch()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.SHOW_TEST_REPORT, async (tests?: ITestResult[]) => await testReportProvider.report(tests)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.SHOW_TEST_OUTPUT, () => showOutputChannel()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.OPEN_TEST_LOG, async () => await openLogFile(storagePath)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL, async () => await runnerScheduler.cleanUp(true /* isCancel */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_CONFIG_MIGRATE, async () => await migrateTestConfig()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EDITOR, async (uri?: Uri, progressReporter?: IProgressReporter) => await executeTestsFromUri(uri, progressReporter, false /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_EDITOR, async (uri?: Uri, progressReporter?: IProgressReporter) => await executeTestsFromUri(uri, progressReporter, true /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_REPORT_OPEN_STACKTRACE, async (trace: string, fullName: string) => await openStackTrace(trace, fullName)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_REPORT_OPEN_TEST_SOURCE_LOCATION, async (uri: string, range: string, fullName: string) => await openTestSourceLocation(uri, range, fullName)),
    );

    setContextKeyForDeprecatedConfig();
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

export function isLightWeightMode(): boolean {
    return serverMode === LanguageServerMode.LightWeight;
}

export function isSwitchingServer(): boolean {
    return serverMode === LanguageServerMode.Hybrid;
}

async function setContextKeyForDeprecatedConfig(): Promise<void> {
    const deprecatedConfigs: Uri[] = await workspace.findFiles('**/.vscode/launch.test.json', null, 1 /*maxResult*/);
    if (deprecatedConfigs.length > 0) {
        commands.executeCommand('setContext', 'java:hasDeprecatedTestConfig', true);
        sendInfo('', { hasDeprecatedTestConfig: 'true' });
    }
}

let serverMode: string | undefined;

const enum LanguageServerMode {
    LightWeight = 'LightWeight',
    Standard = 'Standard',
    Hybrid = 'Hybrid',
}

export let progressProvider: IProgressProvider | undefined;
