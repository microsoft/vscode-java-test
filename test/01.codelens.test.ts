// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { CodeLens, Command, commands, TextDocument, window, workspace } from 'vscode';
import { ITestResultDetails, TestCodeLensProvider, testResultManager, TestStatus } from '../extension.bundle';
import { Token, Uris } from './shared';

suite('Code Lens Tests', () => {

    test("Code Lens should work for JUnit 4's @Test annotation", async () => {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 6, 'Code Lens should appear for @Test annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: any = command!.arguments;
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await commands.executeCommand(command!.command, testItem[0]);

        let result: Map<string, ITestResultDetails> | undefined = testResultManager.getResults(Uris.JUNIT4_TEST.fsPath);
        assert.notEqual(result, undefined, 'Test Result for @Test should not be undefined');

        result = result as Map<string, ITestResultDetails>;
        assert.equal(result.size, 2, 'Should have right number of execution result');
        assert.equal(result.get('junit4.TestAnnotation#shouldFail')!.status, TestStatus.Fail, 'Should have failed case');
        assert.equal(result.get('junit4.TestAnnotation#shouldPass')!.status, TestStatus.Pass, 'Should have passed case');

        await commands.executeCommand('workbench.action.closeActiveEditor');
    }).timeout(60 * 1000 /* ms */);

    test("Code Lens should be present for JUnit 4's @Theory annotation", async () => {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_THEROY);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 6, 'Code Lens should appear for @Theory annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: any = command!.arguments;
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await await commands.executeCommand(command!.command, testItem[0]);

        let result: Map<string, ITestResultDetails> | undefined = testResultManager.getResults(Uris.JUNIT4_THEROY.fsPath);
        assert.notEqual(result, undefined, 'Test Result for @Theory should not be undefined');

        result = result as Map<string, ITestResultDetails>;
        assert.equal(result.size, 2, 'Should have right number of execution result');
        assert.equal(result.get('junit4.TheoryAnnotation#shouldFail')!.status, TestStatus.Fail, 'Should have failed case');
        assert.equal(result.get('junit4.TheoryAnnotation#shouldPass')!.status, TestStatus.Pass, 'Should have passed case');

        await commands.executeCommand('workbench.action.closeActiveEditor');
    }).timeout(60 * 1000 /* ms */);

    test("Code Lens should be present for JUnit 4's @RunWith annotation", async () => {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_RUNWITH);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 2, 'Code Lens should appear for @RunWith annotation');

        // Clear the result cache
        testResultManager.dispose();

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: any = command!.arguments;
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await await commands.executeCommand(command!.command, testItem[0]);

        let result: Map<string, ITestResultDetails> | undefined = testResultManager.getResults(Uris.JUNIT4_TEST.fsPath);
        assert.notEqual(result, undefined, 'Test Result for @Test should not be undefined');

        result = result as Map<string, ITestResultDetails>;
        assert.equal(result.size, 2, 'Should have right number of execution result');
        assert.equal(result.get('junit4.TestAnnotation#shouldFail')!.status, TestStatus.Fail, 'Should have failed case');
        assert.equal(result.get('junit4.TestAnnotation#shouldPass')!.status, TestStatus.Pass, 'Should have passed case');

        await commands.executeCommand('workbench.action.closeActiveEditor');
    }).timeout(60 * 1000 /* ms */);
});
