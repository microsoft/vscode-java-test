// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { commands, TextDocument, window, workspace } from 'vscode';
import { testResultManager, ITestResult, TestStatus } from '../../extension.bundle';
import { setupTestEnv, Uris } from '../shared';

suite('Run from Editor Tests', function() {

    suiteSetup(async function() {
        setupTestEnv();
    });

    test("Can run from active editor", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT5_META_ANNOTATION_TEST);
        await window.showTextDocument(document);

        await commands.executeCommand('java.test.editor.run');

        const detail: ITestResult| undefined = testResultManager.getResultById(`junit@junit5.MetaAnnotationTest#myFastTest`);
        assert.strictEqual(detail!.status, TestStatus.Pass);
    });

    teardown(async function() {
        // Clear the result cache
        testResultManager.dispose();
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
