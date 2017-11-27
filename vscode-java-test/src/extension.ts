'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as cp from 'child_process';
import * as expandHomeDir from 'expand-home-dir';
import * as fs from 'fs';
import * as glob from 'glob';
import * as net from 'net';
import * as path from 'path';
import * as pathExists from 'path-exists';
import * as vscode from 'vscode';

import { Commands, Configs, Constants } from './commands';
import { JUnitCodeLensProvider } from './junitCodeLensProvider';
import { TestResourceManager } from './testResourceManager';
import { OutputChannel, SnippetString } from 'vscode';
import { TestSuite, TestLevel } from './protocols';
import { ClassPathManager } from './classPathManager';
import { TestResultAnalyzer } from './testResultAnalyzer';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
const testResourceManager: TestResourceManager = new TestResourceManager();
const classPathManager: ClassPathManager = new ClassPathManager();
const outputChannel: OutputChannel = vscode.window.createOutputChannel('JUnit Test Result');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const codeLensProvider = new JUnitCodeLensProvider(onDidChange, testResourceManager);
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(Constants.Language, codeLensProvider));

    vscode.workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri;
        testResourceManager.setDirty(uri);
        //onDidChange.fire();
    });

    checkJavaHome().then(javaHome => {
        context.subscriptions.push(vscode.commands.registerCommand(Commands.JAVA_RUN_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            runTest(javaHome, suites, context.storagePath, false)));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (suites: TestSuite[] | TestSuite) =>
            runTest(javaHome, suites, context.storagePath, true)));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.JAVA_TEST_SHOW_DETAILS, (test: TestSuite) =>
            showDetails(test)));
        classPathManager.refresh();
    }).catch((err) => {
        vscode.window.showErrorMessage("couldn't find Java home...");
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
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

function runTest(javaHome: string, tests: TestSuite[] | TestSuite, storagePath: string, debug: boolean) {
    const testList = Array.isArray(tests) ? tests : [tests];
    const suites = testList.map((s) => s.test);
    const uri = vscode.Uri.parse(testList[0].uri);
    const classpaths = classPathManager.getClassPath(uri);
    const port = readPortConfig();
    let params = parseParams(javaHome, classpaths, suites, port, debug);
    if (params === null) {
        return null;
    }
    outputChannel.clear();
    outputChannel.show(true);
    let tempFile = path.resolve(storagePath + '/' + new Date().getTime() + '.bat');
    fs.mkdir(path.dirname(tempFile), (err) => {
        if (!err || err.code === 'EEXIST') {
            fs.writeFile(tempFile, params.join(' '), (err) => {
                if (!err) {
                    const testResultAnalyzer = new TestResultAnalyzer(testList);
                    const process = cp.execFile(tempFile);
                    process.stderr.on('data', (data) => {
                        outputChannel.append(data.toString());
                        testResultAnalyzer.sendData(data.toString());
                    });
                    process.stdout.on('data', (data) => {
                        outputChannel.append(data.toString());
                        testResultAnalyzer.sendData(data.toString());
                    })
                    process.on('close', () => {
                        testResultAnalyzer.feedBack();
                        onDidChange.fire();
                        fs.unlink(tempFile);
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
            });
        }
    })
}

function showDetails(test: TestSuite) {
    const editor = vscode.window.activeTextEditor;
    const uri = vscode.Uri.parse(`${Constants.TEST_OUTPUT_SCHEME}: test-result-${test.test}`);
    return vscode.workspace.openTextDocument(uri).then(doc => {
        return vscode.window.showTextDocument(doc, editor.viewColumn + 1).then(edit => {
            edit.insertSnippet(new SnippetString(getTestReport(test)), new vscode.Position(0, 0));
        });
    });
}

function getTestReport(test: TestSuite): string {
    let report = test.test + ':\n';
    if (!test.result) {
        return report + "Not run...";
    }
    report += JSON.stringify(test.result, null, 4);
    if (test.level === TestLevel.Method) {
        return report;
    }
    report += '\n';
    for (const child of test.children) {
        report += getTestReport(child) + '\n';
    }
    return report;
}

function readPortConfig(): Number {
    const config = vscode.workspace.getConfiguration();
    return config.get<Number>('java.test.port', Configs.JAVA_TEST_PORT);
}

function parseParams(javaHome: string, classpaths: string[], suites: string[], port: Number, debug: boolean): string[] {
    let params = [];
    params.push('"' + path.resolve(javaHome + '/bin/java') + '"');
    let server_home: string = path.resolve(__dirname, '../../server');
    let launchersFound: Array<string> = glob.sync('**/java.junit.runner-*.jar', { cwd: server_home });
    if (launchersFound.length) {
        params.push('-cp');
        classpaths = [path.resolve(server_home, launchersFound[0]), ...classpaths];
        let separator = ';';
        if (process.platform === 'darwin' || process.platform === 'linux') {
            separator = ':';
        }
        params.push('"' + classpaths.join(separator) + '"');
    } else {
        return null;
    }

    if (debug) {
        const debugParams = [];
        debugParams.push('-Xdebug');
        debugParams.push('-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=' + port);
        params = [...params, ...debugParams];
    }

    params.push('com.java.junit.runner.JUnitLauncher');
    params = [...params, ...suites];
    return params;
}