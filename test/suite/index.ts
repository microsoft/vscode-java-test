// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { glob } from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 1 * 60 * 1000,
    });

    const testsRoot = __dirname;

    const files = (await glob('**/**.test.js', { cwd: testsRoot })).sort((a, b) => a.localeCompare(b, 'en'));

    // Add files to the test suite
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise((c, e) => {
        try {
            // Run the mocha test
            mocha.run((failures) => {
                if (failures > 0) {
                    e(new Error(`${failures} tests failed.`));
                } else {
                    c();
                }
            });
        } catch (err) {
            e(err);
        }
    });
}
