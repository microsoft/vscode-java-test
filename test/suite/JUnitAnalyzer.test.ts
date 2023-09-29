// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { MarkdownString, Range, TestController, TestMessage, TestRunRequest, tests, workspace } from 'vscode';
import { JUnitRunnerResultAnalyzer } from '../../src/runners/junitRunner/JUnitRunnerResultAnalyzer';
import { IRunTestContext, TestKind } from '../../src/types';
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
        const testMessage = failedSpy.getCall(1).args[1] as TestMessage;
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
        const testItem = generateTestItem(testController, 'junit@junit5.TestAnnotation#shouldFail2()', TestKind.JUnit5, new Range(8, 0, 10, 0));
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

    // The following test also tests JUnit 5 test classes that contain two
    // methods with the same name but different signatures.
    test("test JUnit 5's display name", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.TestAnnotation#test()', TestKind.JUnit5, new Range(8, 0, 10, 0));
        const testItemWithParams = generateTestItem(testController, 'junit@junit5.TestAnnotation#test(int)', TestKind.JUnit5, new Range(14, 0, 16, 0));
        let testRunRequest = new TestRunRequest([testItem, testItemWithParams], []);
        let testRun = testController.createTestRun(testRunRequest);
        let testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.TestAnnotation,true,2,false,1,TestAnnotation,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]
%TSTTREE3,test(junit5.TestAnnotation),false,1,false,2,hi,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[method:test()]
%TSTTREE4,test(junit5.TestAnnotation),true,0,false,2,hi_with_params,int,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[test-template:test(int)]
%TESTS  3,test(junit5.TestAnnotation)

%TESTE  3,test(junit5.TestAnnotation)
%TSTTREE5,test(junit5.TestAnnotation),false,1,true,4,[1] 1,int,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[test-template:test(int)]/[test-template-invocation:#1]
%TESTS  5,test(junit5.TestAnnotation)
%TESTE  5,test(junit5.TestAnnotation)
%RUNTIME86`;

        let runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem, testItemWithParams],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        let analyzer = new JUnitRunnerResultAnalyzer(runnerContext)
        // We need to stub this method to avoid issues with the TestController
        // not being set up in the non-test version of the utils file.
        const stub = sinon.stub(analyzer, "enlistDynamicMethodToTestMapping");
        stub.returnsArg(0);
        analyzer.analyzeData(testRunnerOutput);

        assert.strictEqual(testItem.description, 'hi');
        assert.strictEqual(testItemWithParams.description, 'hi_with_params');

        // Remove the @DisplayName annotation
        testRunRequest = new TestRunRequest([testItem, testItemWithParams], []);
        testRun = testController.createTestRun(testRunRequest);
        testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.TestAnnotation,true,2,false,1,TestAnnotation,,[engine:junit-jupiter]/[class:junit5.TestAnnotation]
%TSTTREE3,test(junit5.TestAnnotation),false,1,false,2,test(),,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[method:test()]
%TSTTREE4,test(junit5.TestAnnotation),true,0,false,2,test(int),int,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[test-template:test(int)]
%TESTS  3,test(junit5.TestAnnotation)

%TESTE  3,test(junit5.TestAnnotation)
%TSTTREE5,test(junit5.TestAnnotation),false,1,true,4,[1] 1,int,[engine:junit-jupiter]/[class:junit5.TestAnnotation]/[test-template:test(int)]/[test-template-invocation:#1]
%TESTS  5,test(junit5.TestAnnotation)
%TESTE  5,test(junit5.TestAnnotation)
%RUNTIME81`;

        runnerContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem, testItemWithParams],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
        // We need to stub this method to avoid issues with the TestController
        // not being set up in the non-test version of the utils file.
        sinon.stub(analyzer, "enlistDynamicMethodToTestMapping");
        analyzer.analyzeData(testRunnerOutput);

        assert.strictEqual(testItem.description, '');
        assert.strictEqual(testItemWithParams.description, '');
    });

    test("test diff is not duplicated when failing assertion is extracted", () => {
        const range = new Range(9, 0, 11, 0);
        const testItem = generateTestItem(testController, 'junit@junit5.TestWithExtractedEqualityAssertion#test()', TestKind.JUnit5, range, undefined, 'TestWithExtractedEqualityAssertion.java');
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const failedSpy = sinon.spy(testRun, 'failed');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.TestWithExtractedEqualityAssertion,true,1,false,1,TestWithExtractedEqualityAssertion,,[engine:junit-jupiter]/[class:junit5.TestWithExtractedEqualityAssertion]
%TSTTREE3,test(junit5.TestWithExtractedEqualityAssertion),false,1,false,2,test(),,[engine:junit-jupiter]/[class:junit5.TestWithExtractedEqualityAssertion]/[method:test()]
%TESTS  3,test(junit5.TestWithExtractedEqualityAssertion)
%FAILED 3,test(junit5.TestWithExtractedEqualityAssertion)
%EXPECTS
1
%EXPECTE
%ACTUALS
2
%ACTUALE
%TRACES
org.opentest4j.AssertionFailedError: expected: <1> but was: <2>
    at junit5.TestWithExtractedEqualityAssertion.extracted2(TestWithExtractedEqualityAssertion.java:18)
    at junit5.TestWithExtractedEqualityAssertion.extracted1(TestWithExtractedEqualityAssertion.java:14)
    at junit5.TestWithExtractedEqualityAssertion.test(TestWithExtractedEqualityAssertion.java:11)
%TRACEE
%TESTE  3,test(junit5.TestWithExtractedEqualityAssertion)
%RUNTIME55`;
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

        const diffTestMessages = failedSpy.getCalls().map(call => call.args[1] as TestMessage).filter(v => v.actualOutput || v.expectedOutput);
        assert.strictEqual(diffTestMessages.length, 1, "not more than one diff-message");
        const testMessage = diffTestMessages[0];
        assert.strictEqual(testMessage.expectedOutput, '1');
        assert.strictEqual(testMessage.actualOutput, '2');
        assert.strictEqual(testMessage.location?.range.start.line, 10); // =11 - 1, (most precise info we get from the stack trace)
    });

    test("can handle test cases with more than 3 arguments", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.ParameterizedAnnotationTest#testMultiArguments(String,String,String)', TestKind.JUnit5, new Range(10, 0, 16, 0));
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const passedSpy = sinon.spy(testRun, 'passed');
        const testRunnerOutput = `%TESTC  0 v2
%TSTTREE2,junit5.ParameterizedAnnotationTest,true,1,false,1,ParameterizedAnnotationTest,,[engine:junit-jupiter]/[class:junit5.ParameterizedAnnotationTest]
%TSTTREE3,testMultiArguments(junit5.ParameterizedAnnotationTest),true,0,false,2,testMultiArguments(String\\, String\\, String),java.lang.String\\, java.lang.String\\, java.lang.String,[engine:junit-jupiter]/[class:junit5.ParameterizedAnnotationTest]/[test-template:testMultiArguments(java.lang.String\\, java.lang.String\\, java.lang.String)]
%TSTTREE4,testMultiArguments(junit5.ParameterizedAnnotationTest),false,1,true,3,[1] a\\, b\\, c,java.lang.String\\, java.lang.String\\, java.lang.String,[engine:junit-jupiter]/[class:junit5.ParameterizedAnnotationTest]/[test-template:testMultiArguments(java.lang.String\\, java.lang.String\\, java.lang.String)]/[test-template-invocation:#1]
%TESTS  4,testMultiArguments(junit5.ParameterizedAnnotationTest)
%TESTE  4,testMultiArguments(junit5.ParameterizedAnnotationTest)
%RUNTIME162`;
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        const analyzer = new JUnitRunnerResultAnalyzer(runnerContext);

        // We need to stub this method to avoid issues with the TestController
        // not being set up in the non-test version of the utils file.
        const stub = sinon.stub(analyzer, "enlistDynamicMethodToTestMapping");
        const dummy = generateTestItem(testController, 'dummy', TestKind.JUnit5, new Range(10, 0, 16, 0));
        stub.returns(dummy);
        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, dummy);
        sinon.assert.calledWith(passedSpy, dummy);
    });

    test("can handle normal test method with multiple arguments", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.VertxTest#test(Vertx,VertxTestContext)', TestKind.JUnit5, new Range(10, 0, 16, 0));
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const passedSpy = sinon.spy(testRun, 'passed');
        const testRunnerOutput = `%TESTC  1 v2
%TSTTREE2,junit5.VertxTest,true,1,false,1,VertxTest,,[engine:junit-jupiter]/[class:junit5.VertxTest]
%TSTTREE3,test(junit5.VertxTest),false,1,false,2,test(Vertx\\, VertxTestContext),io.vertx.core.Vertx\\, io.vertx.junit5.VertxTestContext,[engine:junit-jupiter]/[class:junit5.VertxTest]/[method:test(io.vertx.core.Vertx\\, io.vertx.junit5.VertxTestContext)]
%TESTS  3,test(junit5.VertxTest)

%TESTE  3,test(junit5.VertxTest)

%RUNTIME1066`;
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
        sinon.assert.calledWith(passedSpy, testItem);
    });

    test("can handle @TestFactory cases", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.TestFactoryTest#testDynamicTest()', TestKind.JUnit5, new Range(10, 0, 16, 0));
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const passedSpy = sinon.spy(testRun, 'passed');
        const testRunnerOutput = `%TESTC  0 v2
%TSTTREE2,junit5.TestFactoryTest,true,1,false,1,TestFactoryTest,,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]
%TSTTREE3,testDynamicTest(junit5.TestFactoryTest),true,0,false,2,testDynamicTest(),,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]/[test-factory:testDynamicTest()]
%TSTTREE4,testDynamicTest(junit5.TestFactoryTest),false,1,true,3,TestInput 1,,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]/[test-factory:testDynamicTest()]/[dynamic-test:#1]
%TESTS  4,testDynamicTest(junit5.TestFactoryTest)

%TESTE  4,testDynamicTest(junit5.TestFactoryTest)

%RUNTIME97`;
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        const analyzer = new JUnitRunnerResultAnalyzer(runnerContext);

        // We need to stub this method to avoid issues with the TestController
        // not being set up in the non-test version of the utils file.
        const stub = sinon.stub(analyzer, "enlistDynamicMethodToTestMapping");
        const dummy = generateTestItem(testController, 'dummy', TestKind.JUnit5, new Range(10, 0, 16, 0));
        stub.returns(dummy);
        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, dummy);
        sinon.assert.calledWith(passedSpy, dummy);
    });

    test("can handle DynamicContainer", () => {
        const testItem = generateTestItem(testController, 'junit@junit5.TestFactoryTest#testContainers()', TestKind.JUnit5, new Range(10, 0, 16, 0));
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const startedSpy = sinon.spy(testRun, 'started');
        const passedSpy = sinon.spy(testRun, 'passed');
        const testRunnerOutput = `%TESTC  0 v2
%TSTTREE2,junit5.TestFactoryTest,true,1,false,1,TestFactoryTest,,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]
%TSTTREE3,testContainers(junit5.TestFactoryTest),true,0,false,2,testContainers(),,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]/[test-factory:testContainers()]
%TSTTREE4,testContainers(junit5.TestFactoryTest),true,0,true,3,Container,,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]/[test-factory:testContainers()]/[dynamic-container:#1]
%TSTTREE5,testContainers(junit5.TestFactoryTest),false,1,true,4,Test,,[engine:junit-jupiter]/[class:junit5.TestFactoryTest]/[test-factory:testContainers()]/[dynamic-container:#1]/[dynamic-test:#1]
%TESTS  5,testContainers(junit5.TestFactoryTest)

%TESTE  5,testContainers(junit5.TestFactoryTest)

%RUNTIME103`;
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };

        const analyzer = new JUnitRunnerResultAnalyzer(runnerContext);

        // We need to stub this method to avoid issues with the TestController
        // not being set up in the non-test version of the utils file.
        const stub = sinon.stub(analyzer, "enlistDynamicMethodToTestMapping");
        const dummy = generateTestItem(testController, 'dummy', TestKind.JUnit5, new Range(10, 0, 16, 0));
        stub.returns(dummy);
        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, dummy);
        sinon.assert.calledWith(passedSpy, dummy);
    });

});
