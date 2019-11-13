// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { extensions } from 'vscode';

suite('Extension Tests', () => {

    test('Extension should be present', () => {
        assert.ok(extensions.getExtension('vscjava.vscode-java-test'));
    });

    test('should activate', async () => {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
        assert.ok(true);
    }).timeout(60 * 1000 /* ms */);
});
