// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { commands } from 'vscode';
import { testResultManager } from '../../extension.bundle';
import { setupTestEnv } from '../shared';

suite('Test Explorer Tests', function() {

    suiteSetup(async function() {
        setupTestEnv();
        testResultManager.dispose();
    });

    test("Can run all the tests", async function() {
        await commands.executeCommand('java.test.explorer.runAll');

        assert.ok(testResultManager.getResultById('junit@junit5.ParameterizedAnnotationTest#canRunWithComment'));
        assert.ok(testResultManager.getResultById('junit@junit5.ParameterizedAnnotationTest#equal'));
        assert.ok(testResultManager.getResultById('junit@junit5.PropertyTest#absoluteValueOfIntegerAlwaysPositive'));
        assert.ok(testResultManager.getResultById('junit@junit5.NestedTest$NestedClassA#test'));
        assert.ok(testResultManager.getResultById('junit@junit5.NestedTest$NestedClassB#test'));
        assert.ok(testResultManager.getResultById('junit@junit5.NestedTest$NestedClassB$ADeeperClass#test'));
    });

    teardown(async function() {
        testResultManager.dispose();
    });
});
