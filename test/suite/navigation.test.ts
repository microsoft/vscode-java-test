// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import { Location, Range, Uri, window } from 'vscode';
import { ITestNavigationResult, navigateToTestOrTarget } from '../../src/commands/navigation/navigationCommands';
import { JavaTestRunnerDelegateCommands } from '../../src/constants';
import { testSourceProvider } from '../../src/provider/testSourceProvider';
import { findTestLocation } from '../../src/runners/utils';
import * as commandUtils from '../../src/utils/commandUtils';
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

    test('passes selected source roots to Go to Test navigation', async () => {
        const filePath: string = path.join(PROJECT_PATH, 'src', 'main', 'java', 'junit', 'App.java');
        await window.showTextDocument(Uri.file(filePath));
        const uri: Uri = window.activeTextEditor!.document.uri;
        const additionalSourcePaths: string[] = [path.join(PROJECT_PATH, 'src', 'main', 'java')];
        const result: ITestNavigationResult = {
            items: [{
                simpleName: 'AppTest',
                fullyQualifiedName: 'junit5.AppTest',
                uri: uri.toString(),
                relevance: 0,
                outOfBelongingProject: false,
            }],
            location: new Location(uri, new Range(0, 0, 0, 0)),
        };
        sinon.stub(testSourceProvider, 'getAdditionalTestSourcePaths').resolves(additionalSourcePaths);
        const commandStub = sinon.stub(commandUtils, 'executeJavaLanguageServerCommand').resolves(result);
        try {
            await navigateToTestOrTarget(true);
            sinon.assert.calledOnceWithExactly(commandStub,
                JavaTestRunnerDelegateCommands.NAVIGATE_TO_TEST_OR_TARGET, uri.toString(), true, additionalSourcePaths);
        } finally {
            sinon.restore();
        }
    });

    test('test find inherited test method location', async () => {
        const location: Location | undefined = await findTestLocation("junit@junit4.ExtendedTest#test");
        assert.ok(location?.uri.fsPath.endsWith("BaseTest.java"));
    });
});
