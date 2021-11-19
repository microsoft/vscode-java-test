// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import assert = require('assert');
import * as path from 'path';
import { Uri, window } from 'vscode';
import { ITestNavigationResult } from '../../src/commands/navigation/navigationCommands';
import { JavaTestRunnerDelegateCommands } from '../../src/constants';
import { executeJavaLanguageServerCommand } from '../../src/utils/commandUtils';
import { setupTestEnv } from "./utils";

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion
const PROJECT_PATH: string = path.join(__dirname, '../../..', 'test', 'test-projects','junit');
suite('Test Navigation Tests', () => {

    suiteSetup(async function() {
        await setupTestEnv();
    });

    test('test go to test', async () => {
        const filePath: string = path.join(PROJECT_PATH, 'src', 'main', 'java', 'junit', 'App.java');
        await window.showTextDocument(Uri.file(filePath));
        const uri: Uri = window.activeTextEditor!.document.uri;
        const searchResult = await executeJavaLanguageServerCommand<ITestNavigationResult>(
            JavaTestRunnerDelegateCommands.NAVIGATE_TO_TEST_OR_TARGET, uri.toString(), true);
        assert.strictEqual(searchResult?.items.length, 1);
        assert.strictEqual(searchResult?.items[0].simpleName, 'AppTest');
        assert.strictEqual(searchResult?.items[0].fullyQualifiedName, 'junit5.AppTest');
    });

    test('test go to test subject', async () => {
        const filePath: string = path.join(PROJECT_PATH, 'src', 'test', 'java', 'junit5', 'AppTest.java');
        await window.showTextDocument(Uri.file(filePath));
        const uri: Uri = window.activeTextEditor!.document.uri;
        const searchResult = await executeJavaLanguageServerCommand<ITestNavigationResult>(
            JavaTestRunnerDelegateCommands.NAVIGATE_TO_TEST_OR_TARGET, uri.toString(), false);
        assert.strictEqual(searchResult?.items.length, 1);
        assert.strictEqual(searchResult?.items[0].simpleName, 'App');
        assert.strictEqual(searchResult?.items[0].fullyQualifiedName, 'junit.App');
    });
});
