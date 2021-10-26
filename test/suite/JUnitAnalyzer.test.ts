// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { IRunTestContext, TestKind, TestLevel } from '../../src/types';
import { MarkdownString, Range, TestController, TestItem, TestMessage, TestRunRequest, tests, Uri, workspace } from 'vscode';
import { JUnitRunnerResultAnalyzer } from '../../src/runners/junitRunner/JUnitRunnerResultAnalyzer';
import { dataCache } from '../../src/controller/testItemDataCache';

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion
suite('JUnit Runner Analyzer Tests', () => {

    let testController: TestController;

    setup(() => {
        testController = tests.createTestController('testController', 'Mock Test');
    });

    teardown(() => {
        testController.dispose();
    });

    test("test JUnit 4 passed result", () => {
        const testItem = generateTestItem(testController, 'junit@junit4.TestAnnotation#shouldPass', TestKind.JUnit);
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const passedSpy = sinon.spy(testRun, 'passed');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE1,shouldPass(junit4.TestAnnotation),false,1,false,-1,shouldPass(junit4.TestAnnotation),,
%TESTS  1,shouldPass(junit4.TestAnnotation)
%TESTE  1,shouldPass(junit4.TestAnnotation)
%RUNTIME15`;
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        const analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, testItem);
        sinon.assert.calledWith(passedSpy, testItem, sinon.match.number);
    });

    test("test JUnit 4 failed result", () => {
        const testItem = generateTestItem(testController, 'junit@junit4.TestAnnotation#shouldFail', TestKind.JUnit);
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const failedSpy = sinon.spy(testRun, 'failed');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE1,shouldFail(junit4.TestAnnotation),false,1,false,-1,shouldFail(junit4.TestAnnotation),,
%TESTS  1,shouldFail(junit4.TestAnnotation)
%FAILED 1,shouldFail(junit4.TestAnnotation)
%TRACES 
java.lang.AssertionError
at org.junit.Assert.fail(Assert.java:87)
at org.junit.Assert.assertTrue(Assert.java:42)
at org.junit.Assert.assertTrue(Assert.java:53)
at junit4.TestAnnotation.shouldFail(TestAnnotation.java:15)
%TRACEE 
%TESTE  1,shouldFail(junit4.TestAnnotation)
%RUNTIME20;`;
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        const analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, testItem);
        sinon.assert.calledWith(failedSpy, testItem, sinon.match.any, sinon.match.number);
        const testMessage = failedSpy.getCall(0).args[1] as TestMessage;
        assert.ok((testMessage.message as MarkdownString).value.includes('junit4.TestAnnotation.shouldFail([TestAnnotation.java:15](command:_java.test.openStackTrace?%5B%22at%20junit4.TestAnnotation.shouldFail(TestAnnotation.java%3A15)%22%2C%22junit%22%5D))'));
    });
});

function generateTestItem(testController: TestController, id: string, testKind: TestKind): TestItem {
    if (!id) {
        throw new Error('id cannot be null');
    }

    const projectName = id.substring(0, id.indexOf('@'));
    const fullName = id.substring(id.indexOf('@') + 1);
    const label = id.substring(id.indexOf('#') + 1);

    const testItem = testController.createTestItem(id, label, Uri.file('/mock/test'));
    testItem.range = new Range(0, 0, 0, 0);
    dataCache.set(testItem, {
        jdtHandler: '',
        fullName,
        projectName,
        testLevel: TestLevel.Method,
        testKind,
    });

    return testItem;
}