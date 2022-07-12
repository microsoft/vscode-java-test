// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { IRunTestContext, TestKind } from '../../src/types';
import { MarkdownString, Range, TestController, TestMessage, TestRunRequest, tests, workspace } from 'vscode';
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

    test("test stacktrace should be simplified", () => {
        const testItem = generateTestItem(testController, 'junit@App#name', TestKind.JUnit);
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const failedSpy = sinon.spy(testRun, 'failed');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE1,name(App),false,1,false,-1,name(App),,
%TESTS  1,name(App)
%FAILED 1,name(App)
%TRACES 
java.lang.AssertionError: expected:<1> but was:<2>
        at org.junit.Assert.fail(Assert.java:89)
        at org.junit.Assert.failNotEquals(Assert.java:835)
        at org.junit.Assert.assertEquals(Assert.java:647)
        at org.junit.Assert.assertEquals(Assert.java:633)
        at App.name(App.java:10)
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
        at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)
        at java.base/java.lang.reflect.Method.invoke(Method.java:566)
        at org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:59)
        at org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)
        at org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:56)
        at org.junit.internal.runners.statements.InvokeMethod.evaluate(InvokeMethod.java:17)
        at org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)
        at org.junit.runners.BlockJUnit4ClassRunner$1.evaluate(BlockJUnit4ClassRunner.java:100)
        at org.junit.runners.ParentRunner.runLeaf(ParentRunner.java:366)
        at org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:103)
        at org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:63)
        at org.junit.runners.ParentRunner$4.run(ParentRunner.java:331)
        at org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:79)
        at org.junit.runners.ParentRunner.runChildren(ParentRunner.java:329)
        at org.junit.runners.ParentRunner.access$100(ParentRunner.java:66)
        at org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:293)
        at org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)
        at org.junit.runners.ParentRunner.run(ParentRunner.java:413)
        at org.eclipse.jdt.internal.junit4.runner.JUnit4TestReference.run(JUnit4TestReference.java:89)
        at org.eclipse.jdt.internal.junit.runner.TestExecution.run(TestExecution.java:40)
        at org.eclipse.jdt.internal.junit.runner.RemoteTestRunner.runTests(RemoteTestRunner.java:529)
        at org.eclipse.jdt.internal.junit.runner.RemoteTestRunner.runTests(RemoteTestRunner.java:756)
        at org.eclipse.jdt.internal.junit.runner.RemoteTestRunner.run(RemoteTestRunner.java:452)
        at org.eclipse.jdt.internal.junit.runner.RemoteTestRunner.main(RemoteTestRunner.java:210)
%TRACEE 
%TESTE  1,name(App)
%RUNTIME58`;
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

        sinon.assert.calledWith(failedSpy, testItem, sinon.match.any, sinon.match.number);
        const testMessage = failedSpy.getCall(0).args[1] as TestMessage;
        const stringLiteral = (testMessage.message as MarkdownString).value;
        assert.ok(stringLiteral.split('<br/>').length === 3);
    });

    test("test message location should be inside the test case when it's covered", () => {
        const testItem = generateTestItem(testController, 'junit@junit4.TestAnnotation#shouldFail', TestKind.JUnit, new Range(10, 0, 16, 0));
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

    test("test message location should at the test header when it's out of the test", () => {
        const testItem = generateTestItem(testController, 'junit@junit4.TestAnnotation#shouldFail', TestKind.JUnit, new Range(8, 0, 10, 0));
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
        assert.strictEqual(testMessage.location?.range.start.line, 8);
    });

    test("test diff with line separators", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.TestAnnotation#shouldFail2', TestKind.JUnit5, new Range(8, 0, 10, 0));
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const failedSpy = sinon.spy(testRun, 'failed');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.TestAnnotation,true,1,false,1,TestAnnotation,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]
%TSTTREE3,shouldFail2(junit5.TestAnnotation),false,1,false,2,shouldFail2(),,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[method:shouldFail2()]
%TESTS  3,shouldFail2(junit5.TestAnnotation)

%FAILED 3,shouldFail2(junit5.TestAnnotation)
%EXPECTS
hello
world
%EXPECTE
%ACTUALS
hello

world
%ACTUALE

%TRACES
org.junit.ComparisonFailure: expected:<hello
[]world> but was:<hello
[
]world>
        at org.junit.Assert.assertEquals(Assert.java:117)
        at org.junit.Assert.assertEquals(Assert.java:146)
        at junit5.TestAnnotation.shouldFail2(TestAnnotation.java:15)

%TRACEE

%TESTE  3,shouldFail2(junit5.TestAnnotation)

%RUNTIME99`;
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        const analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, testItem);
        sinon.assert.calledWith(failedSpy, testItem, sinon.match.any);
        const testMessage = failedSpy.getCall(0).args[1] as TestMessage;
        assert.strictEqual(testMessage.actualOutput, 'hello\n\nworld');
        assert.strictEqual(testMessage.expectedOutput, 'hello\nworld');
        assert.strictEqual(testMessage.location?.range.start.line, 8);
    });

    test("test JUnit 5's display name", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.TestAnnotation#test', TestKind.JUnit5, new Range(8, 0, 10, 0));
        let testRunRequest = new TestRunRequest([testItem], []);
        let testRun = testController.createTestRun(testRunRequest);
        let testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.TestAnnotation,true,1,false,1,TestAnnotation,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]
%TSTTREE3,test(junit5.TestAnnotation),false,1,false,2,hi,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[method:test()]
%TESTS  3,test(junit5.TestAnnotation)

%TESTE  3,test(junit5.TestAnnotation)

%RUNTIME86`;

        let runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        let analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
        analyzer.analyzeData(testRunnerOutput);

        assert.strictEqual(testItem.description, 'hi');

        // Remove the @DisplayName annotation
        testRunRequest = new TestRunRequest([testItem], []);
        testRun = testController.createTestRun(testRunRequest);
        testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.TestAnnotation,true,1,false,1,TestAnnotation,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]
%TSTTREE3,test(junit5.TestAnnotation),false,1,false,2,test(),,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[method:test()]
%TESTS  3,test(junit5.TestAnnotation)

%TESTE  3,test(junit5.TestAnnotation)

%RUNTIME81`;

        runnerContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
        analyzer.analyzeData(testRunnerOutput);

        assert.strictEqual(testItem.description, '');
    });
});
