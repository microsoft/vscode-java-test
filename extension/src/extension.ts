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

import { ClassPathManager } from './classPathManager';
import * as Commands from './commands';
import * as Configs from './configs';
import * as Constants from './constants';
import { JUnitCodeLensProvider } from './junitCodeLensProvider';
import { Logger, LogLevel } from './logger';
import { TestLevel, TestSuite } from './protocols';
import { encodeTestSuite, parseTestReportName, TestReportProvider } from './testReportProvider';
import { TestResourceManager } from './testResourceManager';
import { TestResultAnalyzer } from './testResultAnalyzer';
import { TestStatusBarProvider } from './testStatusBarProvider';
import { TestExplorer } from './Explorer/testExplorer';
import { TestTreeNode } from './Explorer/testTreeNode';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const onDidChange: EventEmitter<void> = new EventEmitter<void>();
const testStatusBarItem: TestStatusBarProvider = TestStatusBarProvider.getInstance();
const outputChannel: OutputChannel = window.createOutputChannel('Test Output');
const logger: Logger = new Logger(outputChannel); // TO-DO: refactor Logger. Make logger stateless and no need to pass the instance.
const testResourceManager: TestResourceManager = new TestResourceManager(logger);
const classPathManager: ClassPathManager = new ClassPathManager(logger);
let running: boolean = false;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    activateTelemetry(context);
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
        context.subscriptions.push(commands.registerCommand(Commands.JAVA_RUN_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            withScopeAsync(() => runSingleton(javaHome, suites, context.storagePath, false), Constants.TELEMETRY_TYPE_RUN_TEST)));
        context.subscriptions.push(commands.registerCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            withScopeAsync(() => runSingleton(javaHome, suites, context.storagePath, true), Constants.TELEMETRY_TYPE_DEBUG_TEST)));
        context.subscriptions.push(commands.registerCommand(Commands.JAVA_TEST_SHOW_REPORT, (test: TestSuite[] | TestSuite) =>
            withScopeAsync(() => showDetails(test), Constants.TELEMETRY_TYPE_SHOW_TEST_REPORT)));
        context.subscriptions.push(commands.registerCommand(Commands.JAVA_TEST_SHOW_OUTPUT, () =>
            withScopeAsync(() => outputChannel.show(), Constants.TELEMETRY_TYPE_SHOW_TEST_OUTPUT)));
        context.subscriptions.push(commands.registerCommand(Commands.JAVA_TEST_EXPLORER_SELECT, (node: TestTreeNode) =>
            withScopeAsync(() => testExplorer.select(node), Constants.TELEMETRY_TYPE_TEST_EXPLORER_SELECT)));
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
}

function activateTelemetry(context: ExtensionContext) {
    const extensionPackage = require(context.asAbsolutePath("./package.json"));
    if (extensionPackage) {
        const packageInfo = {
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey,
        };
        if (packageInfo.aiKey) {
            const telemetryReporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
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

async function runTest(javaHome: string, tests: TestSuite[] | TestSuite, storagePath: string, isDebugMode: boolean) {
    outputChannel.clear();
    const testList = Array.isArray(tests) ? tests : [tests];
    const suites = testList.map((s) => s.test);
    const uri = Uri.parse(testList[0].uri);
    const classpaths = classPathManager.getClassPath(uri);
    let port;
    if (isDebugMode) {
        try {
            port = await getPort();
        } catch (ex) {
            const message = `Failed to get free port for debugging. Details: ${ex}.`;
            window.showErrorMessage(message);
            logger.logError(message);
            throw ex;
        }
    }
    const storageForThisRun = path.join(storagePath, new Date().getTime().toString());
    let params: string[];
    try {
        params = await parseParams(javaHome, classpaths, suites, storageForThisRun, port, isDebugMode);
    } catch (ex) {
        logger.logError(`Exception occers while parsing params. Details: ${ex}`);
        rimraf(storageForThisRun, (err) => {
            if (err) {
                logger.logError(`Failed to delete storage for this run. Storage path: ${err}`);
            }
        });
        throw ex;
    }
    if (params === null) {
        return null;
    }

    const testResultAnalyzer = new TestResultAnalyzer(testList);
    await testStatusBarItem.update(testList, new Promise((resolve, reject) => {
        let error: string = '';
        const process = cp.exec(params.join(' '));
        process.on('error', (err) => {
            logger.logError(`Error occured while running/debugging tests. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`);
            reject(err);
        });
        process.stderr.on('data', (data) => {
            error += data.toString();
            logger.logError(`Error occured: ${data.toString()}`);
            testResultAnalyzer.sendData(data.toString());
        });
        process.stdout.on('data', (data) => {
            logger.logInfo(data.toString());
            testResultAnalyzer.sendData(data.toString());
        });
        process.on('close', () => {
            testResultAnalyzer.feedBack();
            onDidChange.fire();
            if (error !== '') {
                reject(error);
            } else {
                resolve();
            }
            rimraf(storageForThisRun, (err) => {
                if (err) {
                    logger.logError(`Failed to delete storage for this run. Storage path: ${err}`);
                }
            });
        });
        if (isDebugMode) {
            const rootDir = workspace.getWorkspaceFolder(Uri.file(uri.fsPath));
            setTimeout(() => {
                debug.startDebugging(rootDir, {
                    name: 'Debug Junit Test',
                    type: 'java',
                    request: 'attach',
                    hostName: 'localhost',
                    port,
                });
            }, 500);
        }
    }));
}

async function runSingleton(javaHome: string, tests: TestSuite[] | TestSuite, storagePath: string, isDebugMode: boolean) {

    if (running) {
        window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
        logger.logInfo('Skip this run cause we only support running one session at the same time');
        return;
    }
    running = true;
    try {
        await runTest(javaHome, tests, storagePath, isDebugMode);
    } finally {
        running = false;
    }
}

function showDetails(test: TestSuite[] | TestSuite) {
    const testList = Array.isArray(test) ? test : [test];
    const uri: Uri = encodeTestSuite(testList);
    const name: string = parseTestReportName(testList);
    return commands.executeCommand('vscode.previewHtml', uri, ViewColumn.Two, name);
}

async function parseParams(
    javaHome: string,
    classpaths: string[],
    suites: string[],
    storagePath: string,
    port: number | undefined,
    isDebugMode: boolean): Promise<string[]> {

    let params = [];
    params.push('"' + path.resolve(javaHome + '/bin/java') + '"');
    const serverHome: string = path.resolve(__dirname, '../../server');
    const launchersFound: string[] = glob.sync('**/com.microsoft.java.test.runner-*.jar', { cwd: serverHome });
    if (launchersFound.length) {
        params.push('-cp');
        classpaths = [path.resolve(serverHome, launchersFound[0]), ...classpaths];
        let separator = ';';
        if (process.platform === 'darwin' || process.platform === 'linux') {
            separator = ':';
        }
        const classpathStr = await processLongClassPath(classpaths, separator, storagePath);
        params.push('"' + classpathStr + '"');
    } else {
        logger.logError('Failed to locate test server runtime!');
        return null;
    }

    if (isDebugMode) {
        const debugParams = [];
        debugParams.push('-Xdebug');
        debugParams.push('-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=' + port);
        params = [...params, ...debugParams];
    }

    params.push('com.microsoft.java.test.runner.JUnitLauncher');
    params = [...params, ...suites];
    return params;
}

function processLongClassPath(classpaths: string[], separator: string, storagePath: string): Promise<string> {
    const concated = classpaths.join(separator);
    if (concated.length <= Configs.MAX_CLASS_PATH_LENGTH) {
        return Promise.resolve(concated);
    }
    const tempFile = path.join(storagePath, 'path.jar');
    return new Promise((resolve, reject) => {
        mkdirp(path.dirname(tempFile), (err) => {
            if (err && err.code !== 'EEXIST') {
                logger.logError(`Failed to create sub directory for this run. Storage path: ${err}`);
                reject(err);
            }
            const output = fs.createWriteStream(tempFile);
            output.on('close', () => {
                resolve(tempFile);
            });
            const jarfile = archiver('zip');
            jarfile.on('error', (jarErr) => {
                logger.logError(`Failed to process too long class path issue. Error: ${err}`);
                reject(jarErr);
            });
            // pipe archive data to the file
            jarfile.pipe(output);
            jarfile.append(constructManifestFile(classpaths), { name: 'META-INF/MANIFEST.MF' });
            jarfile.finalize();
        });
    });
}

function constructManifestFile(classpaths: string[]): string {
    let content = "";
    const extended = ["Class-Path:", ...classpaths.map((c) => {
        const p = fileUrl(c);
        return p.endsWith('.jar') ? p : p + '/';
    })];
    content += extended.join(` ${os.EOL} `);
    content += os.EOL;
    return content;
}

async function withScopeAsync(action, eventType) {
    const start = new Date();
    const eventId: string = start.getTime().toString();
    const props = {
        eventId,
        type: eventType,
    };
    // tslint:disable-next-line
    let measures = {};
    try {
        const res = await action();
        props[Constants.TELEMETRY_PROPS_STATUS] = 'success';
        return res;
    } catch (ex) {
        props[Constants.TELEMETRY_PROPS_STATUS] = 'fail';
        props[Constants.TELEMETRY_PROPS_EXCEPTION] = ex.toString();
    } finally {
        const end = new Date();
        const duration: number = end.getTime() - start.getTime();
        measures[Constants.TELEMETRY_MEASURES_DURATION] = duration;
        logger.logUsage(props, measures);
    }
}
