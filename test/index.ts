// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from 'vscode-test';

async function main(): Promise<void> {
    try {
        const vscodeExecutablePath = await downloadAndUnzipVSCode();
        const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

        // Resolve redhat.java dependency
        cp.spawnSync(cliPath, ['--install-extension', 'redhat.java'], {
            encoding: 'utf-8',
            stdio: 'inherit',
        });

        cp.spawnSync(cliPath, ['--install-extension', 'vscjava.vscode-java-debug'], {
            encoding: 'utf-8',
            stdio: 'inherit',
        });

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath: string = path.resolve(__dirname, '..', '..');

        // Run maven test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath: path.resolve(__dirname, 'suite'),
            launchArgs: [
                '--disable-workspace-trust',
                path.join(__dirname, '..', '..', 'test', 'test-projects', 'junit'),
            ],
        });

        // Run unmanaged folder test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath: path.resolve(__dirname, 'unmanaged-folder-suite'),
            launchArgs: [
                '--disable-workspace-trust',
                path.join(__dirname, '..', '..', 'test', 'test-projects', 'simple'),
            ],
        });

        process.exit(0);

    } catch (err) {
        process.stdout.write(`${err}${os.EOL}`);
        process.exit(1);
    }
}

main();
