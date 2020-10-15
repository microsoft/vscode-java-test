// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { commands, TextDocument, window, workspace, extensions } from 'vscode';
import { testResultManager, ITestResult, TestStatus } from '../../extension.bundle';
import { Uris } from '../shared';

suite('Run from Editor Tests', function() {

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Can run from active editor", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_META_ANNOTATION_TEST);
        await window.showTextDocument(document);

        await commands.executeCommand('java.test.editor.run');

        const detail: ITestResult| undefined = testResultManager.getResultById(`junit5@junit5.MetaAnnotationTest#myFastTest`);
        assert.strictEqual(detail!.status, TestStatus.Pass);
    });

    teardown(async function() {
        // Clear the result cache
        testResultManager.dispose();
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
