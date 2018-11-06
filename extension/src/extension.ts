// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Disposable, Extension, ExtensionContext, extensions, FileSystemWatcher, languages, Uri, window, workspace } from 'vscode';
import { initializeFromJsonFile, instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { testCodeLensProvider } from './codeLensProvider';
import { debugTests, runTests } from './commands/executeTests';
import { openTextDocumentForNode, runTestsFromExplorer } from './commands/explorerCommands';
import { showReport } from './commands/reportCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { explorerNodeManager } from './explorer/explorerNodeManager';
import { testExplorer } from './explorer/testExplorer';
import { TestTreeNode } from './explorer/TestTreeNode';
import { ITestItem } from './protocols';
import { runnerExecutor } from './runners/runnerExecutor';
import { testOutputChannel } from './testOutputChannel';
import { testReportProvider } from './testReportProvider';
import { testResultManager } from './testResultManager';
import { testStatusBarProvider } from './testStatusBarProvider';

export async function activate(context: ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'));
    await instrumentOperation('activation', doActivate)(context);
}

export function deactivate(): void {
    // do nothing
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    const javaHome: string = await getJavaHome();
    if (!javaHome) {
        throw new Error('Could not find Java home.');
    }

    testExplorer.initialize(context);
    testStatusBarProvider.show();
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

    runnerExecutor.initialize(javaHome, context);
    testReportProvider.initialize(context);

    context.subscriptions.push(
        window.registerTreeDataProvider(testExplorer.testExplorerViewId, testExplorer),
        explorerNodeManager,
        testStatusBarProvider,
        testResultManager,
        watcher,
        testOutputChannel,
        languages.registerCodeLensProvider('java', testCodeLensProvider),
        workspace.registerTextDocumentContentProvider(testReportProvider.scheme, testReportProvider),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.OPEN_DOCUMENT_FOR_NODE, async (node: TestTreeNode) => await openTextDocumentForNode(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.REFRESH_EXPLORER, (node: TestTreeNode) => testExplorer.refresh(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS, async (tests: ITestItem[]) => await runTests(tests)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS, async (tests: ITestItem[]) => await debugTests(tests)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.RUN_TEST_FROM_EXPLORER, async (node?: TestTreeNode) => await runTestsFromExplorer(node)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.SHOW_TEST_REPORT, async (tests: ITestItem[]) => await showReport(tests)),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.SHOW_TEST_OUTPUT, () => testOutputChannel.show()),
        instrumentAndRegisterCommand(JavaTestRunnerCommands.JAVA_TEST_CANCEL, async () => await runnerExecutor.cleanUp(true /* isCancel */)),
    );
    await commands.executeCommand('setContext', 'java.test.activated', true);
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
