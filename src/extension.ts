// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Extension, ExtensionContext, extensions, languages, Range, Uri, window } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation, instrumentOperationAsVsCodeCommand } from 'vscode-extension-telemetry-wrapper';
import { testCodeLensProvider } from './codeLensProvider';
import { debugTestsFromExplorer, openTextDocument, runTestsFromExplorer } from './commands/explorerCommands';
import { openLogFile, showOutputChannel } from './commands/logCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { explorerNodeManager } from './explorer/explorerNodeManager';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';
import { logger } from './logger/logger';
import { ITestItem } from './protocols';
import { ITestResult } from './runners/models';
import { runnerExecutor } from './runners/runnerExecutor';
import { testFileWatcher } from './testFileWatcher';
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

    testFileWatcher.initialize(context);
    testExplorer.initialize(context);
    runnerExecutor.initialize(javaHome, context);
    testReportProvider.initialize(context);

    const storagePath: string = context.storagePath || path.join(os.tmpdir(), 'java_test_runner');
    await fse.ensureDir(storagePath);
    logger.initialize(storagePath, context.subscriptions);

    context.subscriptions.push(
        window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer),
        explorerNodeManager,
        testStatusBarProvider,
        testResultManager,
        testReportProvider,
        logger,
        languages.registerCodeLensProvider({ scheme: 'file', language: 'java' }, testCodeLensProvider),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.OPEN_DOCUMENT, async (uri: Uri, range?: Range) => await openTextDocument(uri, range)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.REFRESH_EXPLORER, (node: TestTreeNode) => testExplorer.refresh(node)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS, async (tests: ITestItem[]) => await runnerExecutor.run(tests, false /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS, async (tests: ITestItem[]) => await runnerExecutor.run(tests, true /* isDebug */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EXPLORER, async (node?: TestTreeNode) => await runTestsFromExplorer(node)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_EXPLORER, async (node?: TestTreeNode) => await debugTestsFromExplorer(node)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.SHOW_TEST_REPORT, async (tests: ITestResult[]) => await testReportProvider.report(tests)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.SHOW_TEST_OUTPUT, () => showOutputChannel()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.OPEN_TEST_LOG, async () => await openLogFile(storagePath)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL, async () => await runnerExecutor.cleanUp(true /* isCancel */)),
    );
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
