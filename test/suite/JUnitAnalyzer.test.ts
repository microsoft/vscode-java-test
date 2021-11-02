// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { IRunTestContext, TestKind } from '../../src/types';
import { MarkdownString, TestController, TestMessage, TestRunRequest, tests, workspace } from 'vscode';
import { JUnitRunnerResultAnalyzer } from '../../src/runners/junitRunner/JUnitRunnerResultAnalyzer';
import { generateTestItem } from './utils';

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

    test("test message location should be inside the test case", () => {
        const testItem = generateTestItem(testController, 'junit@junit4.TestAnnotation#shouldFail', TestKind.JUnit);
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const erroredSpy = sinon.spy(testRun, 'errored');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE1,shouldFail(junit4.TestAnnotation),false,1,false,-1,shouldFail(junit4.TestAnnotation),,
%TESTS  1,shouldFail(junit4.TestAnnotation)
%ERROR  1,shouldFail(junit4.TestAnnotation)
%TRACES 
java.lang.RuntimeException
        at junit4.TestAnnotation.fail2(TestAnnotation.java:23)
        at junit4.TestAnnotation.fail(TestAnnotation.java:19)
        at junit4.TestAnnotation.shouldFail(TestAnnotation.java:15)
        at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
        at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
%TRACEE 
%TESTE  1,shouldFail(junit4.TestAnnotation)
%RUNTIME16`;
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
        sinon.assert.calledWith(erroredSpy, testItem, sinon.match.any);
        const testMessage = erroredSpy.getCall(0).args[1] as TestMessage;
        assert.strictEqual(testMessage.location?.range.start.line, 14);
    });
});
