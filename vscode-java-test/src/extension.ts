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

import { Commands, Configs } from './commands';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows?'.exe':'');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    return checkJavaHome().then(javaHome => {
        let outputChannel = vscode.window.createOutputChannel('JUnit Test Result');
        
		vscode.commands.registerCommand(Commands.JAVA_RUN_TEST_COMMAND, (uri: string, classpaths: string[], suites: string[]) =>
		 runTest(javaHome, outputChannel, uri, classpaths, suites, context.storagePath, false));           
		vscode.commands.registerCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (uri: string, classpaths: string[], suites: string[]) =>
		 runTest(javaHome, outputChannel, uri, classpaths, suites, context.storagePath, true));
    }).catch((err) => {
        vscode.window.showErrorMessage("couldn't find Java home...");
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function checkJavaHome(): Promise<string> {
    return new Promise((resolve, reject) => {
        let source : string;
        let javaHome : string = readJavaConfig();
        if (!javaHome) {
            javaHome = process.env['JDK_HOME'];
            if (!javaHome) {
                javaHome = process.env['JAVA_HOME'];
            }
        }
        if(!javaHome){
            reject();
        }
        javaHome = expandHomeDir(javaHome);
        if(!pathExists.sync(javaHome)){
            reject();
        }
        if(!pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))){
            reject();
        }
        return resolve(javaHome);
    });
}

function readJavaConfig() : string {
    const config = vscode.workspace.getConfiguration();
    return config.get<string>('java.home',null);
}

function runTest(javaHome: string, outputChannel: vscode.OutputChannel, uri: string, classpaths: string[], suites: string[], storagePath: string, debug: boolean) {
	let params = parseParams(javaHome, classpaths, suites, debug);
	if (params === null) {
		return null;
	}
	outputChannel.clear();
	outputChannel.show(true);
	let tempFile = path.resolve(storagePath + '/'+ new Date().getTime() + '.bat');
	fs.mkdir(path.dirname(tempFile), (err) => {
		if (!err || err.code === 'EEXIST') {
			fs.writeFile(tempFile, params.join(' '), (err) => {
				if (!err) {
					const process = cp.execFile(tempFile);
					process.stderr.on('data', (data) => {
						outputChannel.append(data.toString());
					});
					process.stdout.on('data', (data) => {
						outputChannel.append(data.toString());
					})
					process.on('close', () => {
						fs.unlink(tempFile);
					});
					if (debug) {
						const rootDir = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(vscode.Uri.parse(uri).fsPath));
						vscode.debug.startDebugging(rootDir, {
							'name': 'Debug Junit Test',
							'type': 'java',
							'request': 'attach',
							'hostName': 'localhost',
							'port': Configs.JAVA_TEST_PORT
						});
					}
				}
			});
		}
	})
}

function parseParams(javaHome: string, classpaths: string[], suites: string[], debug: boolean): string[] {
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
		const port = Configs.JAVA_TEST_PORT;
		const debugParams = [];
		debugParams.push('-Xdebug');
		debugParams.push('-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=' + port);
		params = [...params, ...debugParams];
	}

	params.push('com.java.junit.runner.JUnitLauncher');
	params = [...params, ...suites];	
	return params;
}

async function generatePort() {
	while (true) {
		const port = Math.floor(Math.random()*65535);
		const valid = await checkPortInUse(port);
		if (valid) {
			return port.toString();
		}
	}
}

function checkPortInUse(port) {
	return new Promise((resolve, reject) => {
		const server = net.createServer(socket => {
			socket.pipe(socket);
		});
		server.listen(port, '127.0.0.1');
		server.on('error', e => reject(false));
		server.on('listening', e => {
			resolve(true);
			server.close();
		});
	});
}