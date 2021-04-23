// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { RelativePattern } from 'vscode';
import { testSourceProvider } from '../../extension.bundle';
import * as assert from 'assert';
import { setupTestEnv } from '../shared';

suite('Test File Watcher Tests', function() {

    suiteSetup(async function() {
        setupTestEnv();
    });

    test("Should correctly get the test source paths", async function() {
        const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern();
        assert.strictEqual(patterns.length, 3);
    });
});
