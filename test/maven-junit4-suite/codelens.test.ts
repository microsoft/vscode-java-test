// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { CodeLens, Command, commands, TextDocument, window, workspace, extensions } from 'vscode';
import { IExecutionCache, ITestResult, runnerScheduler, TestCodeLensProvider, testResultManager, TestStatus, ITestItem } from '../../extension.bundle';
import { Token, Uris } from '../shared';

suite('Code Lens Tests', function() {

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Code Lens should work for JUnit 4's @Test annotation", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 6, 'Code Lens should appear for @Test annotation');

        const command: Command | undefined = codeLens[4].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        // TODO: compare test item in cache and run from it.
        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;
        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.TestAnnotation#shouldFail`);
        assert.equal(failedDetail!.status, TestStatus.Fail, 'Should have failed case');
        assert.ok(failedDetail!.duration !== undefined, 'Should have execution time');

        const passedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.TestAnnotation#shouldPass`);
        assert.equal(passedDetail!.status, TestStatus.Pass, 'Should have passed case');
        assert.ok(passedDetail!.duration !== undefined, 'Should have execution time');

        const executionCache: IExecutionCache = runnerScheduler.getExecutionCache();
        assert.ok(executionCache.context != undefined);
        assert.equal(executionCache.results!.length, 2);
    });

    test("Code Lens should be present for JUnit 4's @Theory annotation", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_THEROY);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 6, 'Code Lens should appear for @Theory annotation');

        const command: Command | undefined = codeLens[4].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;
        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.TheoryAnnotation#shouldFail`);
        assert.equal(failedDetail!.status, TestStatus.Fail, 'Should have failed case');
        assert.ok(failedDetail!.duration !== undefined, 'Should have execution time');

        const passedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.TheoryAnnotation#shouldPass`);
        assert.equal(passedDetail!.status, TestStatus.Pass, 'Should have passed case');
        assert.ok(passedDetail!.duration !== undefined, 'Should have execution time');
    });

    test("Code Lens should be present for JUnit 4's @RunWith annotation", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_RUNWITH);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 2, 'Code Lens should appear for @RunWith annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: any = command!.arguments;
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;
        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.TestAnnotation#shouldFail`);
        assert.equal(failedDetail!.status, TestStatus.Fail, 'Should have failed case');
        assert.ok(failedDetail!.duration !== undefined, 'Should have execution time');

        const passedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.TestAnnotation#shouldPass`);
        assert.equal(passedDetail!.status, TestStatus.Pass, 'Should have passed case');
        assert.ok(passedDetail!.duration !== undefined, 'Should have execution time');
    });

    test("Handle exception thrown in methods annotated with @Before", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_EXCEPTION_BEFORE);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 4, 'Code Lens should appear.');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: any = command!.arguments;
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;
        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.ExceptionInBefore#<TestError>`);
        assert.equal(failedDetail!.status, TestStatus.Fail, 'Should have failed case');
        assert.ok(failedDetail!.trace !== undefined, 'Should have error trace');
    });

    test("Can run parameterized tests", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_PARAMETERIZED_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 4, 'Code Lens should appear for @Test annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.notEqual(testItem, undefined, 'Test Item inside Code Lens Command should not be undefined');
        assert.notEqual(testItem, null, 'Test Item inside Code Lens Command should not be null');
        assert.equal(testItem.length, 1, 'Test Item inside Code Lens Command should has one element');

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;
        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.ParameterizedTest#test`);
        assert.equal(failedDetail!.status, TestStatus.Fail, 'Should have failed case');
        assert.ok(failedDetail!.duration !== undefined, 'Should have execution time');
    });

    test("Assume failure should mark as skipped", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.JUNIT4_ASSUME_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        const command: Command | undefined = codeLens[0].command;
        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;
        const skippedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit4.AssumeTest#shouldSkip`);
        assert.equal(skippedDetail!.status, TestStatus.Skip, 'Should have skipped case');
        assert.ok(skippedDetail!.duration !== undefined, 'Should have execution time');
    });

    teardown(async function() {
        // Clear the result cache
        testResultManager.dispose();
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
