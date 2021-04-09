// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as path from 'path';
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests  } from 'vscode-test';
import * as util from 'util';

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath: string = path.resolve(__dirname, '../../');

        const vscodeExecutablePath: string = await downloadAndUnzipVSCode('stable');
        const cliPath: string = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

        cp.spawnSync(cliPath, ['--install-extension', 'redhat.java'], {
            encoding: 'utf-8',
            stdio: 'inherit',
        });

        cp.spawnSync(cliPath, ['--install-extension', 'vscjava.vscode-java-debug'], {
            encoding: 'utf-8',
            stdio: 'inherit',
        });

        // Run Maven JUnit tests
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath: path.resolve(__dirname, './maven-junit-suite'),
            launchArgs: [
                path.join(__dirname, '..', '..', 'test', 'test-projects', 'junit'),
            ],
        });
        await killJavaProcess();

        // Run Gradle modular project tests
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath: path.resolve(__dirname, './gradle-modular-suite'),
            launchArgs: [
                path.join(__dirname, '..', '..', 'test', 'test-projects', 'modular-gradle'),
            ],
        });
        await killJavaProcess();
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}


async function killJavaProcess(): Promise<void> {
    const execAsync = util.promisify(cp.exec);
    try {
        if (process.platform === "win32") {
            await execAsync(`wmic process where "name like '%java%'" delete`);
        } else {
            await execAsync("kill -9 $(jps | awk '{print $1}')");
        }
    } catch (e) {
        // ignore
    }
}

main();

