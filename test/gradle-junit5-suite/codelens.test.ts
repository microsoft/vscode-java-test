// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { CodeLens, Command, commands, TextDocument, window, workspace, extensions } from 'vscode';
import { TestCodeLensProvider, testResultManager, ITestItem, ITestResult, TestStatus } from '../../extension.bundle';
import { Token, Uris } from '../shared';

suite('Code Lens Tests', function() {

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Can run test method if it has comments above", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_PARAMETERIZED_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.strictEqual(codeLens.length, 8, 'Code Lens should appear for @ParameterizedTest annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notStrictEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notStrictEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.strictEqual(testItem.length, 1);

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;

        const passedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit5.ParameterizedAnnotationTest#canRunWithComment`);
        assert.strictEqual(passedDetail!.status, TestStatus.Pass, 'Should have passed case');
        assert.ok(passedDetail!.duration !== undefined, 'Should have execution time');
    });

    test("Can get correct result", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_PARAMETERIZED_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);

        const command: Command | undefined = codeLens[4].command;

        const testItem: ITestItem[] = command!.arguments as ITestItem[];

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;

        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit5.ParameterizedAnnotationTest#equal`);
        assert.strictEqual(failedDetail!.status, TestStatus.Fail);
        assert.ok(failedDetail!.trace !== undefined, 'Should have error trace');
    });

    test("Can run test with generic typed parameter", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_PARAMETERIZED_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);

        const command: Command | undefined = codeLens[2].command;

        const testItem: ITestItem[] = command!.arguments as ITestItem[];

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;

        const detail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit5.ParameterizedAnnotationTest#canRunWithGenericTypedParameter`);
        assert.strictEqual(detail!.status, TestStatus.Pass);
    });

    test("Can run test method annotated with @Testable", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_PROPERTY_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.strictEqual(codeLens.length, 4, 'Code Lens should appear for @Property annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notStrictEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notStrictEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.strictEqual(testItem.length, 1);

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;

        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit5.PropertyTest#absoluteValueOfIntegerAlwaysPositive`);
        assert.strictEqual(failedDetail!.status, TestStatus.Fail);
        assert.ok(failedDetail!.duration !== undefined, 'Should have execution time');
    });

    test("Can show Code Lens for methods annotated with meta-annotation", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_META_ANNOTATION_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        let codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.strictEqual(codeLens.length, 4);
    });

    test("Can run test method annotated with @Nested", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_NESTED_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        let codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.strictEqual(codeLens.length, 14, 'Code Lens should appear for @Nested annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notStrictEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notStrictEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.strictEqual(testItem.length, 1);

        await commands.executeCommand(command!.command, testItem[0]);

        codeLens = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);

        assert.strictEqual(codeLens.length, 21);

        assert.strictEqual(codeLens[2].command!.title, '$(x)');
        assert.strictEqual(codeLens[5].command!.title, '$(check)');
    });

    test("Can correctly update the test results for cucumber tests", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_CUCUMBER_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);

        const command: Command | undefined = codeLens[0].command;

        const testItem: ITestItem[] = command!.arguments as ITestItem[];

        await commands.executeCommand(command!.command, testItem[0]);
        const projectName: string = testItem[0].project;

        let result: ITestResult| undefined = testResultManager.getResultById(`${projectName}@The calculator application#client wants to add 2 numbers`);
        assert.strictEqual(result!.status, TestStatus.Fail);

        // Correct the test case
        const fileContent: string = await fse.readFile(Uris.GRADLE_CUCUMBER_STEP.fsPath, 'utf-8');
        await fse.writeFile(Uris.GRADLE_CUCUMBER_STEP.fsPath,
            fileContent.replace('assertEquals(value + 1, 6);', 'assertEquals(value, 6);'), {encoding: 'utf-8'});

        await commands.executeCommand('java.workspace.compile', false);

        await commands.executeCommand('java.test.relaunch');
        result = testResultManager.getResultById(`${projectName}@The calculator application#client wants to add 2 numbers`);
        assert.strictEqual(result!.status, TestStatus.Pass);

        // revert the file change
        await fse.writeFile(Uris.GRADLE_CUCUMBER_STEP.fsPath, fileContent, {encoding: 'utf-8'});
    });

    teardown(async function() {
        // Clear the result cache
        testResultManager.dispose();
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
