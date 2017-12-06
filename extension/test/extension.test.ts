// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as vscode from 'vscode';

import * as myExtension from '../src/extension';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

    test("Extension should be present", () => {
        assert.ok(vscode.extensions.getExtension("vscjava.vscode-java-test"));
    });
    test("should activate", function() {
        this.timeout(1 * 60 * 1000);
        return vscode.extensions.getExtension("vscjava.vscode-java-test").activate().then((api) => {
            assert.ok(true);
        });
    });
});
