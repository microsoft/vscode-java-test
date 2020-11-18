// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { commands, window, extensions } from 'vscode';
import { Uris } from '../shared';

suite('Test Report Tests', function() {

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Can open test source location from uri and range", async function() {
        await commands.executeCommand(
            'java.test.report.openTestSourceLocation',
            Uris.GRADLE_JUNIT5_PARAMETERIZED_TEST.toString(),
            '{"start":{"line":30,"character":16},"end":{"line":30,"character":21}}',
            undefined,
        );

        assert.strictEqual(window.activeTextEditor?.document.uri.fsPath, Uris.GRADLE_JUNIT5_PARAMETERIZED_TEST.fsPath);
        assert.strictEqual(window.activeTextEditor?.selection.start.line, 30);
    });

    test("Can open test source location from fullName", async function() {
        await commands.executeCommand(
            'java.test.report.openTestSourceLocation',
            undefined,
            undefined,
            'junit5@junit5.ParameterizedAnnotationTest#equal',
        );
        
        assert.strictEqual(window.activeTextEditor?.document.uri.fsPath, Uris.GRADLE_JUNIT5_PARAMETERIZED_TEST.fsPath);
        assert.strictEqual(window.activeTextEditor?.selection.start.line, 30);
    });

    test("Can open test source location from stack trace", async function() {
        await commands.executeCommand(
            'java.test.report.openStackTrace',
            'at org.junit.jupiter.api.AssertionUtils.fail(AssertionUtils.java:55)',
            'junit5@junit5.ParameterizedAnnotationTest#equal',
        );

        assert.ok(window.activeTextEditor?.document.uri.fsPath.endsWith('AssertionUtils.class'));
        assert.strictEqual(window.activeTextEditor?.selection.start.line, 54);
    });

    teardown(async function() {
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
