// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { CodeLens, Command, commands, TextDocument, window, workspace, extensions } from 'vscode';
import { ITestResult, TestCodeLensProvider, testResultManager, TestStatus, ITestItem } from '../../extension.bundle';
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
        assert.equal(codeLens.length, 4, 'Code Lens should appear for @ParameterizedTest annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.equal(testItem.length, 1);
        assert.equal(testItem[0].paramTypes[0], 'java.lang.String');
        assert.equal(testItem[0].paramTypes[1], 'java.lang.Boolean');

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;

        const passedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit5.ParameterizedAnnotationTest#canRunWithComment`);
        assert.equal(passedDetail!.status, TestStatus.Pass, 'Should have passed case');
        assert.ok(passedDetail!.duration !== undefined, 'Should have execution time');
    });

    test("Can run test method annotated with @Testable", async function() {
        const document: TextDocument = await workspace.openTextDocument(Uris.GRADLE_JUNIT5_PROPERTY_TEST);
        await window.showTextDocument(document);

        const codeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
        const codeLens: CodeLens[] = await codeLensProvider.provideCodeLenses(document, Token.cancellationToken);
        assert.equal(codeLens.length, 4, 'Code Lens should appear for @ParameterizedTest annotation');

        const command: Command | undefined = codeLens[0].command;
        assert.notEqual(command, undefined, 'Command inside Code Lens should not be undefined');
        assert.notEqual(command, null, 'Command inside Code Lens should not be null');

        const testItem: ITestItem[] = command!.arguments as ITestItem[];
        assert.equal(testItem.length, 1);
        assert.equal(testItem[0].paramTypes[0], 'int');

        await commands.executeCommand(command!.command, testItem[0]);

        const projectName: string = testItem[0].project;

        const failedDetail: ITestResult| undefined = testResultManager.getResultById(`${projectName}@junit5.PropertyTest#absoluteValueOfIntegerAlwaysPositive`);
        assert.equal(failedDetail!.status, TestStatus.Fail);
        assert.ok(failedDetail!.duration !== undefined, 'Should have execution time');
    });

    teardown(async function() {
        // Clear the result cache
        testResultManager.dispose();
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
