// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as fse from 'fs-extra';
import { Uri, window } from 'vscode';
import { enableTests } from '../../src/commands/testDependenciesCommands';
import { setupTestEnv, sleep } from '../suite/utils';
import { TestKind } from '../../src/java-test-runner.api';

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
        // A correctly downloaded artifact must be a stable release of
        // junit-platform-console-standalone (no pre-release qualifier such as
        // -M3, -RC1, -beta-1, ...). This guards against the stale Maven
        // search.maven.org Solr index that used to return milestone versions
        // as the "latest" — see microsoft/vscode-java-test#1866.
        const STABLE_JAR_PATTERN: RegExp = /^junit-platform-console-standalone-\d+(\.\d+)*\.jar$/;
        for (let i = 0; i < 5; i++) {
            if (await fse.pathExists(LIB_PATH)) {
                const files: string[] = await fse.readdir(LIB_PATH);
                const stableJar: string | undefined = files.find((file) => STABLE_JAR_PATTERN.test(file));
                if (stableJar) {
                    return;
                }
                const anyMatching: string[] = files.filter((file) => file.includes('junit-platform-console-standalone'));
                if (anyMatching.length > 0) {
                    assert.fail(
                        `Downloaded jar is not a stable release. Got: ${anyMatching.join(', ')}. ` +
                        `Expected a file matching ${STABLE_JAR_PATTERN}.`,
                    );
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
