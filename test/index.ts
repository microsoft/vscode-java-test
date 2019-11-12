// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as path from 'path';
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests  } from 'vscode-test';

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath: string = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath: string = path.resolve(__dirname, './suite/index');

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

        // Download VS Code, unzip it and run the integration test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                path.join(__dirname, '..', '..', 'test', 'test-projects'),
            ],
        });
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
