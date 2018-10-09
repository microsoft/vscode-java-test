// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import { commands, extensions, languages, window, workspace, Disposable,
    EventEmitter, ExtensionContext, OutputChannel, Uri, ViewColumn } from 'vscode';
import { dispose as disposeTelemetryWrapper, initializeFromJsonFile, instrumentOperation,
    TelemetryWrapper } from 'vscode-extension-telemetry-wrapper';
import { ClassPathManager } from './classPathManager';
import { JUnitCodeLensProvider } from './junitCodeLensProvider';
import { ProjectManager } from './projectManager';
import { TestConfigManager } from './testConfigManager';
import { encodeTestSuite, parseTestReportName, TestReportProvider } from './testReportProvider';
import { TestResourceManager } from './testResourceManager';
import { TestStatusBarProvider } from './testStatusBarProvider';
import * as Commands from './Constants/commands';
import * as Configs from './Constants/configs';
import * as Constants from './Constants/constants';
import { TestExplorer } from './Explorer/testExplorer';
import { TestTreeNode } from './Explorer/testTreeNode';
import { TestKind, TestSuite } from './Models/protocols';
import { RunConfig, RunConfigItem, TestConfig } from './Models/testConfig';
import { TestRunnerWrapper } from './Runner/testRunnerWrapper';
import { JUnit5TestRunner } from './Runner/JUnitTestRunner/junit5TestRunner';
import { JUnitTestRunner } from './Runner/JUnitTestRunner/junitTestRunner';
import { CommandUtility } from './Utils/commandUtility';
import * as Logger from './Utils/Logger/logger';
import { OutputTransport } from './Utils/Logger/outputTransport';
import { TelemetryTransport } from './Utils/Logger/telemetryTransport';

const onDidChange: EventEmitter<void> = new EventEmitter<void>();
const testStatusBarItem: TestStatusBarProvider = TestStatusBarProvider.getInstance();
const outputChannel: OutputChannel = window.createOutputChannel('Test Output');
const testResourceManager: TestResourceManager = new TestResourceManager();
const projectManager: ProjectManager = new ProjectManager();
const classPathManager: ClassPathManager = new ClassPathManager(projectManager);
const testConfigManager: TestConfigManager = new TestConfigManager(projectManager);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    TelemetryWrapper.initilizeFromJsonFile(context.asAbsolutePath('./package.json'));
    context.subscriptions.push(TelemetryWrapper.getReporter());
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'));
    await instrumentOperation('activation', doActivate)(context);
}

async function doActivate(_operationId: string, context: ExtensionContext): Promise<void> {
    Logger.configure(
        context,
        [
            new TelemetryTransport({ level: 'warn', name: 'telemetry' }),
            new OutputTransport({ level: 'info', channel: outputChannel, name: 'output' }),
        ],
    );
    await testStatusBarItem.init(testResourceManager.refresh());
    const codeLensProvider = new JUnitCodeLensProvider(onDidChange, testResourceManager);
    context.subscriptions.push(languages.registerCodeLensProvider(Configs.LANGUAGE, codeLensProvider));
    const testReportProvider: TestReportProvider = new TestReportProvider(context, testResourceManager);
    context.subscriptions.push(workspace.registerTextDocumentContentProvider(TestReportProvider.scheme, testReportProvider));
    const testExplorer = new TestExplorer(context, testResourceManager);
    context.subscriptions.push(window.registerTreeDataProvider(Constants.TEST_EXPLORER_VIEW_ID, testExplorer));
    testResourceManager.onDidChangeTestStorage(() => {
        testExplorer.refresh();
    });
    const watcher = workspace.createFileSystemWatcher('**/*.{[jJ][aA][vV][aA]}');
    context.subscriptions.push(watcher);
    watcher.onDidChange((uri) => {
        testResourceManager.setDirty(uri);
        onDidChange.fire();
    });
    watcher.onDidDelete((uri) => {
        testResourceManager.removeTests(uri);
    });

    const reports = new Set();
    workspace.onDidOpenTextDocument((document) => {
        const uri = document.uri;
        if (uri.scheme === TestReportProvider.scheme) {
            reports.add(uri);
        }
    });
    workspace.onDidCloseTextDocument((document) => {
        const uri = document.uri;
        if (uri.scheme === TestReportProvider.scheme) {
            reports.delete(uri);
        }
    });

    codeLensProvider.onDidChangeCodeLenses(() => {
        if (reports.size > 0) {
            reports.forEach((uri) => {
                testReportProvider.refresh(uri);
            });
        }
    });

    const javaHome: string = await getJavaHome();
    if (!javaHome) {
        const errMsg: string = 'Could not find Java home...';
        Logger.error(errMsg, {}, true);
        throw new Error(errMsg);
    }

    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_RUN_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
        runTest(suites, false, true)));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
        runTest(suites, true, true)));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_SHOW_REPORT, (test: TestSuite[] | TestSuite) =>
        showDetails(test)));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_SHOW_OUTPUT, () =>
        outputChannel.show()));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_EXPLORER_SELECT, (node: TestTreeNode) =>
        testExplorer.select(node)));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_EXPLORER_RUN_TEST, (node: TestTreeNode) =>
        runTestFromExplorer(testExplorer, node, false, true)));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_EXPLORER_DEBUG_TEST, (node: TestTreeNode) =>
        runTestFromExplorer(testExplorer, node, true, true)));
    context.subscriptions.push(
        instrumentAndRegisterCommand(Commands.JAVA_TEST_EXPLORER_RUN_TEST_WITH_CONFIG, (node: TestTreeNode) =>
        runTestFromExplorer(testExplorer, node, false, false)));
    context.subscriptions.push(
        instrumentAndRegisterCommand(Commands.JAVA_TEST_EXPLORER_DEBUG_TEST_WITH_CONFIG, (node: TestTreeNode) =>
        runTestFromExplorer(testExplorer, node, true, false)));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_OPEN_LOG, () =>
        openTestLogFile(context.asAbsolutePath(Configs.LOG_FILE_NAME))));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_CONFIGURE_TEST_COMMAND, () =>
        testConfigManager.editConfig()));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_TEST_CANCEL, () =>
        TestRunnerWrapper.cancel()));
    context.subscriptions.push(instrumentAndRegisterCommand(Commands.JAVA_CLASSPATH_REFRESH, () =>
        classPathManager.refresh()));
    TestRunnerWrapper.registerRunner(
        TestKind.JUnit, new JUnitTestRunner(javaHome, context.storagePath, classPathManager, projectManager, onDidChange));
    TestRunnerWrapper.registerRunner(
        TestKind.JUnit5, new JUnit5TestRunner(javaHome, context.storagePath, classPathManager, projectManager, onDidChange));
    await classPathManager.refresh();
    await commands.executeCommand('setContext', 'java.test.activated', true);
}

export async function deactivate() {
    testResourceManager.dispose();
    classPathManager.dispose();
    testStatusBarItem.dispose();
    CommandUtility.clearCommandsCache();
    await disposeTelemetryWrapper();
}

function instrumentAndRegisterCommand(name: string, cb: (...args: any[]) => any): Disposable {
    const instrumented: (...args: any[]) => any = instrumentOperation(name, async (_operationId: string, ...args: any[]) => cb(...args));
    return TelemetryWrapper.registerCommand(name, instrumented);
}

async function getJavaHome(): Promise<string> {
    const extension = extensions.getExtension('redhat.java');
    try {
        const extensionApi = await extension.activate();
        if (extensionApi && extensionApi.javaRequirement) {
            return extensionApi.javaRequirement.java_home;
        }
    } catch (ex) {
    }

    return '';
}

async function runTest(tests: TestSuite[] | TestSuite, isDebugMode: boolean, defaultConfig: boolean) {
    outputChannel.clear();
    const testList = Array.isArray(tests) ? tests : [tests];
    const config = await getTestConfig(testList, isDebugMode, defaultConfig);
    return TestRunnerWrapper.run(testList, isDebugMode, config);
}

async function runTestFromExplorer(explorer: TestExplorer, node: TestTreeNode, isDebugMode: boolean, defaultConfig: boolean) {
    const tests = explorer.resolveTestSuites(node);
    return runTest(tests, isDebugMode, defaultConfig);
}

async function getTestConfig(tests: TestSuite[], isDebugMode: boolean, isDefault: boolean): Promise<RunConfigItem> {
    let configs: TestConfig[];
    try {
        configs = await testConfigManager.loadConfig(tests);
    } catch (ex) {
        window.showErrorMessage(
            `Failed to load the test config! Please check whether your test configuration is a valid JSON file. Details: ${ex.message}.`);
        throw ex;
    }
    const runConfigs: RunConfig[] = isDebugMode ? configs.map((c) => c.debug) : configs.map((c) => c.run);
    if (isDefault) {
        // we don't support `Run with default config` if you trigger the test from multi-root folders.
        if (runConfigs.length !== 1 || !runConfigs[0].default) {
            return undefined;
        }
        const runConfig = runConfigs[0];
        const candidates = runConfig.items.filter((i) => i.name === runConfig.default);
        if (candidates.length === 0) {
            window.showWarningMessage(`There is no config with name: ${runConfig.default}.`);
            return undefined;
        }
        if (candidates.length > 1) {
            window.showWarningMessage(`Duplicate configs with default name: ${runConfig.default}.`);
        }
        return candidates[0];
    }
    if (runConfigs.length > 1) {
        window.showWarningMessage('It is not supported to run tests with config from multi root.');
    }
    const items = runConfigs.reduce((a, r) => a.concat(r.items), []).map((c) => {
        return {
            label: c.name,
            description: `project name: ${c.projectName}`,
            item: c,
        };
    });
    const selection = await window.showQuickPick(items, { placeHolder: 'Select test config' });
    if (!selection) {
        throw new Error('Please specify the test config to use!');
    }
    return selection.item;
}

function showDetails(test: TestSuite[] | TestSuite) {
    const testList = Array.isArray(test) ? test : [test];
    const uri: Uri = encodeTestSuite(testList);
    const name: string = parseTestReportName(testList);
    const config = workspace.getConfiguration();
    const position: string = config.get<string>('java.test.report.position', 'sideView');
    return commands.executeCommand('vscode.previewHtml', uri, position === 'sideView' ? ViewColumn.Two : ViewColumn.Active, name);
}

function openTestLogFile(logFile: string): Thenable<boolean> {
    return workspace.openTextDocument(logFile).then((doc) => {
        return window.showTextDocument(doc);
    }, () => false).then((didOpen) => {
        if (!didOpen) {
            window.showWarningMessage('Could not open Test Log file');
        }
        return didOpen ? true : false;
    });
}
