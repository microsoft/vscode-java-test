// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { commands, Disposable, Extension, ExtensionContext, extensions, FileSystemWatcher, languages, Uri, window, workspace } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { testCodeLensProvider } from './codeLensProvider';
import { debugTests, runTests } from './commands/executeTests';
import { debugTestsFromExplorer, debugTestsWithFromExplorer, openTextDocumentForNode, runTestsFromExplorer, runTestsWithConfigFromExplorer } from './commands/explorerCommands';
import { openLogFile, showOutputChannel } from './commands/logCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { explorerNodeManager } from './explorer/explorerNodeManager';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';
import { logger } from './logger/logger';
import { ITestItem } from './protocols';
import { runnerExecutor } from './runners/runnerExecutor';
import { testReportProvider } from './testReportProvider';
import { testResultManager } from './testResultManager';
import { testStatusBarProvider } from './testStatusBarProvider';

export async function activate(context: ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'));
    await instrumentOperation('activation', doActivate)(context);
}

export async function deactivate(): Promise<void> {
    await disposeTelemetryWrapper();
    await runnerExecutor.cleanUp(false  /* isCancel */);
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    const javaHome: string = await getJavaHome();
    if (!javaHome) {
        throw new Error('Could not find Java home.');
    }

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

    testExplorer.initialize(context);
    runnerExecutor.initialize(javaHome, context);
    testReportProvider.initialize(context);

    const storagePath: string = context.storagePath || path.join(os.tmpdir(), 'java_test_runner');
    await fse.ensureDir(storagePath);
    logger.initialize(storagePath);

    context.subscriptions.push(
        window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer),
        explorerNodeManager,
        testStatusBarProvider,
        testResultManager,
        testReportProvider,
        logger,
        watcher,
        languages.registerCodeLensProvider({ scheme: 'file', language: 'java' }, testCodeLensProvider),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.OPEN_DOCUMENT_FOR_NODE, async (node: TestTreeNode) => await openTextDocumentForNode(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.REFRESH_EXPLORER, (node: TestTreeNode) => testExplorer.refresh(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS, async (tests: ITestItem[]) => await runTests(tests)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS, async (tests: ITestItem[]) => await debugTests(tests)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EXPLORER, async (node?: TestTreeNode) => await runTestsFromExplorer(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_EXPLORER, async (node?: TestTreeNode) => await debugTestsFromExplorer(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.RUN_TEST_WITH_CONFIG_FROM_EXPLORER, async (node?: TestTreeNode) => await runTestsWithConfigFromExplorer(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.DEBUG_TEST_WITH_CONFIG_FROM_EXPLORER, async (node?: TestTreeNode) => await debugTestsWithFromExplorer(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.SHOW_TEST_REPORT, async (tests: ITestItem[]) => await testReportProvider.report(tests)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.SHOW_TEST_OUTPUT, () => showOutputChannel()),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.OPEN_TEST_LOG, async () => await openLogFile(storagePath)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL, async () => await runnerExecutor.cleanUp(true /* isCancel */)),
    );
}

function instrumentAndRegisterCommand(name: string, cb: (...args: any[]) => any): Disposable {
    const instrumented: (...args: any[]) => any = instrumentOperation(name, async (_operationId: string, ...args: any[]) => await cb(...args));
    return commands.registerCommand(name, instrumented);
}

async function getJavaHome(): Promise<string> {
    const extension: Extension<any> | undefined = extensions.getExtension('redhat.java');
    try {
        const extensionApi: any = await extension!.activate();
        if (extensionApi && extensionApi.javaRequirement) {
            return extensionApi.javaRequirement.java_home;
        }
    } catch (error) {
        // Swallow the error
    }

    return '';
}
