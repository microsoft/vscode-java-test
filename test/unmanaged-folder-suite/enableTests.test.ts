// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as fse from 'fs-extra';
import { Uri, window } from 'vscode';
import { enableTests } from '../../src/commands/testDependenciesCommands';
import { TestKind } from '../../src/types';
import { setupTestEnv, sleep } from '../suite/utils';

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion
const PROJECT_PATH: string = path.join(__dirname, '../../..', 'test', 'test-projects','simple');
const LIB_PATH: string = path.join(PROJECT_PATH, 'lib');

suite('Test Enable Tests', () => {

    suiteSetup(async function() {
        const filePath: string = path.join(PROJECT_PATH, 'src', 'App.java');
        await window.showTextDocument(Uri.file(filePath));
        await setupTestEnv();
    });

    test('test enable tests for unmanaged folder', async () => {
        await enableTests(TestKind.JUnit5);
        for (let i = 0; i < 5; i++) {
            if (await fse.pathExists(LIB_PATH)) {
                const files: string[] = await fse.readdir(LIB_PATH);
                const downloaded: boolean = files.some((file) => {
                    return file.includes('junit-platform-console-standalone');
                });
                if (downloaded) {
                    return;
                }
            }
            await sleep(1000 /*ms*/);
        }

        assert.fail('Failed to download test dependencies for unmanaged folder.');
    });

    suiteTeardown(async function() {
        await fse.remove(LIB_PATH);
    })

});
