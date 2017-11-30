// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as archiver from 'archiver';
import * as cp from 'child_process';
import * as expandHomeDir from 'expand-home-dir';
import * as fileUrl from 'file-url';
import * as fs from 'fs';
import * as glob from 'glob';
import * as mkdirp from 'mkdirp';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as pathExists from 'path-exists';
import * as rimraf from 'rimraf';
import * as vscode from 'vscode';

import { Commands, Configs, Constants } from './commands';
import { JUnitCodeLensProvider } from './junitCodeLensProvider';
import { TestResourceManager } from './testResourceManager';
import { OutputChannel, SnippetString, ExtensionContext } from 'vscode';
import { TestSuite, TestLevel } from './protocols';
import { ClassPathManager } from './classPathManager';
import { TestResultAnalyzer } from './testResultAnalyzer';
import TelemetryReporter from 'vscode-extension-telemetry';
import { Logger, LogLevel } from './logger';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
const testResourceManager: TestResourceManager = new TestResourceManager();
const classPathManager: ClassPathManager = new ClassPathManager();
const outputChannel: OutputChannel = vscode.window.createOutputChannel('Test Output');
const logger: Logger = new Logger(outputChannel);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    activateTelemetry(context);
    const codeLensProvider = new JUnitCodeLensProvider(onDidChange, testResourceManager, logger);
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(Constants.LANGUAGE, codeLensProvider));

    vscode.workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri;
        testResourceManager.setDirty(uri);
        //onDidChange.fire();
    });

    checkJavaHome().then(javaHome => {
        context.subscriptions.push(vscode.commands.registerCommand(Commands.JAVA_RUN_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            withScopeAsync(() => runTest(javaHome, suites, context.storagePath, false), "Run Test")));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            withScopeAsync(() => runTest(javaHome, suites, context.storagePath, true), "Debug Test")));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.JAVA_TEST_SHOW_DETAILS, (test: TestSuite) =>
            withScopeAsync(() => showDetails(test), "Show Test details")));
        classPathManager.refresh();
    }).catch((err) => {
        vscode.window.showErrorMessage("couldn't find Java home...");
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
    testResourceManager.dispose();
    classPathManager.dispose();
    logger.dispose();
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
        let source: string;
        let javaHome: string = readJavaConfig();
        if (!javaHome) {
            javaHome = process.env['JDK_HOME'];
            if (!javaHome) {
                javaHome = process.env['JAVA_HOME'];
            }
        }
        if (!javaHome) {
            reject();
        }
        javaHome = expandHomeDir(javaHome);
        if (!pathExists.sync(javaHome)) {
            reject();
        }
        if (!pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
            reject();
        }
        return resolve(javaHome);
    });
}

function readJavaConfig(): string {
    const config = vscode.workspace.getConfiguration();
    return config.get<string>('java.home', null);
}

async function runTest(javaHome: string, tests: TestSuite[] | TestSuite, storagePath: string, debug: boolean) {
    outputChannel.clear();
    outputChannel.show(true);
    const testList = Array.isArray(tests) ? tests : [tests];
    const suites = testList.map((s) => s.test);
    const uri = vscode.Uri.parse(testList[0].uri);
    const classpaths = classPathManager.getClassPath(uri);
    const port = readPortConfig();
    const storageForThisRun = path.join(storagePath, new Date().getTime().toString());
    let params: string[];
    try {
        params = await parseParams(javaHome, classpaths, suites, storageForThisRun, port, debug);
    } catch (ex) {
        logger.logError(`Exception occers while parsing params. Details: ${ex}`);
        rimraf(storageForThisRun, (err) => {
            if (err) {
                logger.logError(`Fail to delete storage for this run. Storage path: ${err}`);
            }
        });
        return null;
    }
    if (params === null) {
        return null;
    }
    
    const testResultAnalyzer = new TestResultAnalyzer(testList);
    const process = cp.exec(params.join(' '));
    process.on('error', (err) => {
        logger.logError(`Error occured while running/debugging tests. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`);
        throw err;
    })
    process.stderr.on('data', (data) => {
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
        rimraf(storageForThisRun, (err) => {
            if (err) {
                logger.logError(`Failed to delete storage for this run. Storage path: ${err}`);
            }
        });
    });
    if (debug) {
        const rootDir = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(uri.fsPath));
        vscode.debug.startDebugging(rootDir, {
            'name': 'Debug Junit Test',
            'type': 'java',
            'request': 'attach',
            'hostName': 'localhost',
            'port': port
        });
    }
}

function showDetails(test: TestSuite) {
    const editor = vscode.window.activeTextEditor;
    const dir = path.dirname(editor.document.uri.fsPath);
    const uri = vscode.Uri.parse(`${Constants.TEST_OUTPUT_SCHEME}:${path.join(dir, 'test-result-' + test.test)}`);
    return vscode.workspace.openTextDocument(uri).then(doc => {
        return vscode.window.showTextDocument(doc, editor.viewColumn + 1).then(edit => {
            edit.insertSnippet(new SnippetString(getTestReport(test)), new vscode.Position(0, 0));
        });
    });
}

function getTestReport(test: TestSuite): string {
    let report = test.test + ':' + os.EOL;
    if (!test.result) {
        return report + "Not run...";
    }
    report += JSON.stringify(test.result, null, 4);
    if (test.level === TestLevel.Method) {
        return report;
    }
    report += os.EOL;
    for (const child of test.children) {
        report += getTestReport(child) + os.EOL;
    }
    return report;
}

function readPortConfig(): Number {
    const config = vscode.workspace.getConfiguration();
    return config.get<Number>('java.test.port', Configs.JAVA_TEST_PORT);
}

async function parseParams(
    javaHome: string,
    classpaths: string[],
    suites: string[],
    storagePath: string,
    port: Number,
    debug: boolean): Promise<string[]> {

    let params = [];
    params.push('"' + path.resolve(javaHome + '/bin/java') + '"');
    let server_home: string = path.resolve(__dirname, '../../server');
    let launchersFound: Array<string> = glob.sync('**/com.microsoft.java.test.runner-*.jar', { cwd: server_home });
    if (launchersFound.length) {
        params.push('-cp');
        classpaths = [path.resolve(server_home, launchersFound[0]), ...classpaths];
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

    if (debug) {
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
    if (concated.length <= Constants.MAX_CLASS_PATH_LENGTH) {
        return Promise.resolve(concated);
    }
    let tempFile = path.join(storagePath, 'path.jar');
    return new Promise((resolve, reject) => {
        mkdirp(path.dirname(tempFile), (err) => {
            if (err && err.code !== 'EEXIST') {
                logger.logError(`Failed to create sub directory for this run. Storage path: ${err}`);
                reject(err);
            }
            const output = fs.createWriteStream(tempFile);
            output.on('close', () => {
                resolve(tempFile);
            })
            const jarfile = archiver('zip');
            jarfile.on('error', function (err) {
                logger.logError(`Failed to process too long class path issue. Error: ${err}`);
                reject(err);
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
    let extended = ["Class-Path:", ...classpaths.map((c) => {
        const path = fileUrl(c);
        return path.endsWith('.jar') ? path : path + '/';
    })];
    content += extended.join(` ${os.EOL} `);
    content += os.EOL;
    return content;
}

async function withScopeAsync(action, eventType) {
    const start = new Date();
    const eventId: string = start.getTime().toString();
    let props = {
        'eventId': eventId,
        'type': eventType,
    };
    let measures = {};
    try {
        const res = await action();
        props['status'] = 'success';
        return res;
    } catch (ex) {
        props['status'] = 'fail';
        props['exception'] = ex.toString();
    } finally {
        const end = new Date();
        const duration: number = end.getTime() - start.getTime();
        measures['duration'] = duration;
        logger.logUsage(props, measures);
    }
}