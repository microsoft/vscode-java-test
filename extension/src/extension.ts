// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as archiver from 'archiver';
import * as cp from 'child_process';
import * as expandHomeDir from 'expand-home-dir';
import * as fileUrl from 'file-url';
import * as findJavaHome from 'find-java-home';
import * as fs from 'fs';
import * as getPort from "get-port";
import * as glob from 'glob';
import * as mkdirp from 'mkdirp';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as pathExists from 'path-exists';
import * as rimraf from 'rimraf';
// tslint:disable-next-line
import { commands, debug, languages, window, workspace, EventEmitter, ExtensionContext, OutputChannel, ProgressLocation, Uri, ViewColumn } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { Session, TelemetryWrapper } from 'vscode-extension-telemetry-wrapper';

import { ClassPathManager } from './classPathManager';
import { JUnitCodeLensProvider } from './junitCodeLensProvider';
import { Logger, LogLevel } from './logger';
import { encodeTestSuite, parseTestReportName, TestReportProvider } from './testReportProvider';
import { TestResourceManager } from './testResourceManager';
import { TestStatusBarProvider } from './testStatusBarProvider';
import * as Commands from './Constants/commands';
import * as Configs from './Constants/configs';
import * as Constants from './Constants/constants';
import { TestExplorer } from './Explorer/testExplorer';
import { TestTreeNode } from './Explorer/testTreeNode';
import { TestKind, TestLevel, TestSuite } from './Models/protocols';
import { TestRunnerWrapper } from './Runner/testRunnerWrapper';
import { JUnitTestRunner } from './Runner/JUnitTestRunner/junitTestRunner';
import { CommandUtility } from './Utils/commandUtility';
/* import * as Logger2 from './Utils/Logger/logger';
import { OutputTransport } from './Utils/Logger/outputTransport';
import { TelemetryTransport } from './Utils/Logger/telemetryTransport'; */

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const onDidChange: EventEmitter<void> = new EventEmitter<void>();
const testStatusBarItem: TestStatusBarProvider = TestStatusBarProvider.getInstance();
const outputChannel: OutputChannel = window.createOutputChannel('Test Output');
const logger: Logger = new Logger(outputChannel); // TO-DO: refactor Logger. Make logger stateless and no need to pass the instance.
const testResourceManager: TestResourceManager = new TestResourceManager(logger);
const classPathManager: ClassPathManager = new ClassPathManager(logger);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    activateTelemetry(context);
    // Logger2.configure([new TelemetryTransport({ level: 'warn' }), new OutputTransport({ channel: outputChannel })]);
    await testStatusBarItem.init(testResourceManager.refresh());
    const codeLensProvider = new JUnitCodeLensProvider(onDidChange, testResourceManager, logger);
    context.subscriptions.push(languages.registerCodeLensProvider(Configs.LANGUAGE, codeLensProvider));
    const testReportProvider: TestReportProvider = new TestReportProvider(context, testResourceManager);
    context.subscriptions.push(workspace.registerTextDocumentContentProvider(TestReportProvider.scheme, testReportProvider));
    const testExplorer = new TestExplorer(context, testResourceManager);
    context.subscriptions.push(window.registerTreeDataProvider(Constants.TEST_EXPLORER_VIEW_ID, testExplorer));
    testResourceManager.onDidChangeTestStorage((e) => {
        testExplorer.refresh();
    });

    workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri;
        testResourceManager.setDirty(uri);
        // onDidChange.fire();
    });

    workspace.onDidSaveTextDocument((document) => {
        const uri = document.uri;
        testResourceManager.setDirty(uri);
        onDidChange.fire();
    });

    checkJavaHome().then((javaHome) => {
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_RUN_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            runTest(suites, false)));
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            runTest(suites, true)));
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_TEST_SHOW_REPORT, (test: TestSuite[] | TestSuite) =>
            showDetails(test)));
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_TEST_SHOW_OUTPUT, () =>
            outputChannel.show()));
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_SELECT, (node: TestTreeNode) =>
            testExplorer.select(node)));
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_RUN_TEST, (node: TestTreeNode) =>
            testExplorer.run(node, false)));
        context.subscriptions.push(TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_DEBUG_TEST, (node: TestTreeNode) =>
            testExplorer.run(node, true)));
        TestRunnerWrapper.registerRunner(TestKind.JUnit, new JUnitTestRunner(javaHome, context.storagePath, classPathManager, onDidChange, logger));
        classPathManager.refresh();
    }).catch((err) => {
        window.showErrorMessage("couldn't find Java home...");
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
    testResourceManager.dispose();
    classPathManager.dispose();
    logger.dispose();
    testStatusBarItem.dispose();
    CommandUtility.clearCommandsCache();
}

function activateTelemetry(context: ExtensionContext) {
    const extensionPackage = require(context.asAbsolutePath("./package.json"));
    if (extensionPackage) {
        const packageInfo = {
            publisher: extensionPackage.publisher,
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey,
        };
        if (packageInfo.aiKey) {
            TelemetryWrapper.initilize(packageInfo.publisher, packageInfo.name, packageInfo.version, packageInfo.aiKey);
            const telemetryReporter: TelemetryReporter = TelemetryWrapper.getReporter();
            telemetryReporter.sendTelemetryEvent(Constants.TELEMETRY_ACTIVATION_SCOPE, {});
            logger.setTelemetryReporter(telemetryReporter, LogLevel.Error);
        }
    }
}

function checkJavaHome(): Promise<string> {
    return new Promise((resolve, reject) => {
        let javaHome: string = readJavaConfig();
        if (!javaHome) {
            javaHome = process.env[Constants.JDK_HOME];
            if (!javaHome) {
                javaHome = process.env[Constants.JAVA_HOME];
            }
        }
        if (javaHome) {
            javaHome = expandHomeDir(javaHome);
            if (pathExists.sync(javaHome) && pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
                return resolve(javaHome);
            }
        }
        findJavaHome((err, home) => {
            if (err) {
                reject(err);
            }
            resolve(home);
        });
    });
}

function readJavaConfig(): string {
    const config = workspace.getConfiguration();
    return config.get<string>('java.home', null);
}

function runTest(tests: TestSuite[] | TestSuite, isDebugMode: boolean) {
    outputChannel.clear();
    const testList = Array.isArray(tests) ? tests : [tests];
    return TestRunnerWrapper.run(testList, isDebugMode);
}

function showDetails(test: TestSuite[] | TestSuite) {
    const testList = Array.isArray(test) ? test : [test];
    const uri: Uri = encodeTestSuite(testList);
    const name: string = parseTestReportName(testList);
    return commands.executeCommand('vscode.previewHtml', uri, ViewColumn.Two, name);
}
