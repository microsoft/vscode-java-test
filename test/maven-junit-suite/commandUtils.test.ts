// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from "path";
import { commands, TextDocument, window, workspace, Uri } from 'vscode';
import { searchTestLocation, ILocation } from '../../extension.bundle';
import { setupTestEnv, Uris } from '../shared';

suite('Command Utils Tests', function() {

    suiteSetup(async function() {
        setupTestEnv()
    });

    test("Can search location for <TestError> items", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_TEST);
        await window.showTextDocument(document);

        const location: ILocation[] = await searchTestLocation('junit4.ExceptionInBefore#<TestError>');
        assert.ok(location);
        assert.ok(location.length === 1);
        assert.ok(path.relative(Uri.parse(location[0].uri).fsPath, Uris.JUNIT4_EXCEPTION_BEFORE.fsPath) == '');
    });

    teardown(async function() {
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
