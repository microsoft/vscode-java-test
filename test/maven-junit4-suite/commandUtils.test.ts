// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { commands, TextDocument, window, workspace, extensions } from 'vscode';
import { searchTestLocation, ILocation } from '../../extension.bundle';
import { Uris } from '../shared';

suite('Command Utils Tests', function() {

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Can search location for <TestError> items", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_TEST);
        await window.showTextDocument(document);

        const location: ILocation[] = await searchTestLocation('junit4.ExceptionInBefore#<TestError>');
        assert.ok(location);
        assert.ok(location.length === 1);
        assert.equal(location[0].uri, Uris.JUNIT4_EXCEPTION_BEFORE);
    });

    teardown(async function() {
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
