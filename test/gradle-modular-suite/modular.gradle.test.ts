// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { CodeLens, Command, commands, TextDocument, window, workspace } from 'vscode';
import { ITestResult, TestCodeLensProvider, testResultManager, ITestItem } from '../../extension.bundle';
import { getJavaVersion, Token, Uris } from '../shared';

suite('Modular Porject Tests', function() {

    let javaVersion: number = -1;

    suiteSetup(async function() {
        javaVersion = await getJavaVersion();
    });

    test('Modular project should work in Gradle', async function() {
        if (javaVersion <= 8) {
            this.skip();
        }
        const document: TextDocument = await workspace.openTextDocument(Uris.MODULAR_GRADLE_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);

        const command: Command | undefined = codeLens[0].command;
        const testItem: ITestItem[] | undefined = command!.arguments;
        await commands.executeCommand(command!.command, testItem![0]);

        const result: ITestResult | undefined = testResultManager.getResultById(testItem![0].id);
        assert.notEqual(result, undefined, 'Test Result for @Test should not be undefined');
    });

    teardown(async function() {
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
