// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { DebugConfiguration, ExtensionContext, Range, Uri, window } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation, instrumentOperationAsVsCodeCommand } from 'vscode-extension-telemetry-wrapper';
import { testCodeLensController } from './codelens/TestCodeLensController';
import { debugTestsFromExplorer, openTextDocument, runTestsFromExplorer } from './commands/explorerCommands';
import { openLogFile, showOutputChannel } from './commands/logCommands';
import { runFromCodeLens } from './commands/runFromCodeLens';
import { JavaTestRunnerCommands } from './constants/commands';
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
}

export async function deactivate(): Promise<void> {
    await disposeTelemetryWrapper();
    await runnerScheduler.cleanUp(false  /* isCancel */);
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    await testFileWatcher.registerListeners();
    testExplorer.initialize(context);
    runnerScheduler.initialize(context);
    testReportProvider.initialize(context);

    const storagePath: string = context.storagePath || path.join(os.tmpdir(), 'java_test_runner');
    await fse.ensureDir(storagePath);
    logger.initialize(storagePath, context.subscriptions);

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
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.SHOW_TEST_REPORT, async (tests: ITestResult[]) => await testReportProvider.report(tests)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.SHOW_TEST_OUTPUT, () => showOutputChannel()),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.OPEN_TEST_LOG, async () => await openLogFile(storagePath)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL, async () => await runnerScheduler.cleanUp(true /* isCancel */)),
        instrumentOperationAsVsCodeCommand(JavaTestRunnerCommands.JAVA_CONFIG_MIGRATE, async () => await migrateTestConfig()),
    );
}
