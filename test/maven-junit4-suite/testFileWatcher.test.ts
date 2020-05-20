// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, TextDocument, workspace, extensions } from 'vscode';
import { Uris } from '../shared';
import { testFileWatcher } from '../../extension.bundle';
import * as assert from 'assert';

suite('Test File Watcher Tests', function() {

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Should check source file is a test file or not", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_TEST);
        assert.ok(testFileWatcher.isOnTestSourcePath(document.uri.fsPath));
    });

    teardown(async function() {
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
