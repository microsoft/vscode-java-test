// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as sinon from 'sinon';
import { Range, TestController, TestItem, TestMessage, TestRunRequest, tests, workspace } from 'vscode';
import { JUnitRunnerResultAnalyzer } from '../../src/runners/junitRunner/JUnitRunnerResultAnalyzer';
import { TestKind } from '../../src/types';
import { generateTestItem } from './utils';

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion
suite('JUnit Runner Analyzer Tests for JUnit5 Parallel Tests', () => {

    let testController: TestController;

    let testItem1: TestItem;
    let testItem2: TestItem;

    let startedSpy: sinon.SinonSpy<[test: TestItem], void>;
    let passedSpy: sinon.SinonSpy<[test: TestItem, duration?: number | undefined], void>;
    let failedSpy: sinon.SinonSpy<[test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number | undefined], void>;

    let analyzer: JUnitRunnerResultAnalyzer;

    setup(() => {
        testController = tests.createTestController('testController', 'Mock Test');
        const testItemParent = generateTestItem(testController, 'junit@junit5.ParallelExecutionTest', TestKind.JUnit5, new Range(0, 0, 0, 0), undefined, 'ParallelExecutionTest.java');
        testItem1 = generateTestItem(testController, 'junit@junit5.ParallelExecutionTest#test1()', TestKind.JUnit5, new Range(1, 0, 1, 0), undefined, 'ParallelExecutionTest.java');
        testItem2 = generateTestItem(testController, 'junit@junit5.ParallelExecutionTest#test2()', TestKind.JUnit5, new Range(2, 0, 2, 0), undefined, 'ParallelExecutionTest.java');
        testItemParent.children.add(testItem1);
        testItemParent.children.add(testItem2);
        const testRunRequest = new TestRunRequest([testItemParent], []);
        const testRun = testController.createTestRun(testRunRequest);
        startedSpy = sinon.spy(testRun, 'started');
        passedSpy = sinon.spy(testRun, 'passed');
        failedSpy = sinon.spy(testRun, 'failed');
        const runnerContext = {
            isDebug: false,
            kind: TestKind.JUnit5,
            projectName: 'junit',
            testItems: [testItemParent],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        analyzer = new JUnitRunnerResultAnalyzer(runnerContext);
    });

    teardown(() => {
        testController.dispose();
    });

    test("successfull parallel execution of 2 test methods within a class", () => {


        let testRunnerOutput =
            `
%TESTC  2 v2

%TSTTREE2,junit5.ParallelExecutionTest,true,2,false,1,ParallelExecutionTest,,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]

%TSTTREE3,test1(junit5.ParallelExecutionTest),false,1,false,2,test1(),,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]/[method:test1()]
%TSTTREE4,test2(junit5.ParallelExecutionTest),false,1,false,2,test2(),,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]/[method:test2()]

%TESTS  3,test1(junit5.ParallelExecutionTest)
%TESTS  4,test2(junit5.ParallelExecutionTest)

%TESTE  3,test1(junit5.ParallelExecutionTest)
%TESTE  4,test2(junit5.ParallelExecutionTest)

%RUNTIME58
`;

        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, testItem1);
        sinon.assert.calledWith(startedSpy, testItem2);
        sinon.assert.calledWith(passedSpy, testItem1);
        sinon.assert.calledWith(passedSpy, testItem2);
    });

    test("failed parallel execution with traces", () => {

        let testRunnerOutput =
            `
%TESTC  2 v2
%TSTTREE2,junit5.ParallelExecutionTest,true,2,false,1,ParallelExecutionTest,,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]

%TSTTREE3,test1(junit5.ParallelExecutionTest),false,1,false,2,test1(),,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]/[method:test1()]
%TSTTREE4,test2(junit5.ParallelExecutionTest),false,1,false,2,test2(),,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]/[method:test2()]

%TESTS  3,test1(junit5.ParallelExecutionTest)
%TESTS  4,test2(junit5.ParallelExecutionTest)

%FAILED 3,test1(junit5.ParallelExecutionTest)
%TRACES
org.opentest4j.AssertionFailedError: test1 failed
at org.junit.jupiter.api.Assertions.fail(Assertions.java:109)
at junit5.ParallelExecutionTest.fail(ParallelExecutionTest.java:53)
at junit5.ParallelExecutionTest.test1(ParallelExecutionTest.java:40)
at java.base/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:165)
%TRACEE

%FAILED 4,test2(junit5.ParallelExecutionTest)
%TRACES
org.opentest4j.AssertionFailedError: test2 failed
at org.junit.jupiter.api.Assertions.fail(Assertions.java:109)
at junit5.ParallelExecutionTest.fail(ParallelExecutionTest.java:53)
at junit5.ParallelExecutionTest.test1(ParallelExecutionTest.java:48)
at java.base/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:165)
%TRACEE

%TESTE  3,test1(junit5.ParallelExecutionTest)
%TESTE  4,test2(junit5.ParallelExecutionTest)

%RUNTIME79
`;

        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, testItem1);
        sinon.assert.calledWith(startedSpy, testItem2);

        sinon.assert.calledWith(failedSpy, testItem2, sinon.match.any, sinon.match.number);
        sinon.assert.calledWith(failedSpy, testItem2, sinon.match({
            message: sinon.match({
                value: sinon.match(/AssertionFailedError.*test2/)
            })
        }));

        sinon.assert.calledWith(failedSpy, testItem1, sinon.match.any, sinon.match.number);
        sinon.assert.calledWith(failedSpy, testItem1, sinon.match({
            message: sinon.match({
                value: sinon.match(/AssertionFailedError.*test1/)
            })
        }));

    });

    test("failed parallel execution with comparison failure", () => {

        let testRunnerOutput =
            `
%TESTC  2 v2
%TSTTREE2,junit5.ParallelExecutionTest,true,2,false,1,ParallelExecutionTest,,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]
%TSTTREE3,test1(junit5.ParallelExecutionTest),false,1,false,2,test1(),,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]/[method:test1()]
%TSTTREE4,test2(junit5.ParallelExecutionTest),false,1,false,2,test2(),,[engine:junit-jupiter]/[class:junit5.ParallelExecutionTest]/[method:test2()]

%TESTS  3,test1(junit5.ParallelExecutionTest)
%TESTS  4,test2(junit5.ParallelExecutionTest)

%FAILED 3,test1(junit5.ParallelExecutionTest)
%EXPECTS
expected1
%EXPECTE
%ACTUALS
actual1
%ACTUALE
%TRACES
org.opentest4j.AssertionFailedError: comparison1 failed
    at junit5.ParallelExecutionTest.test1(ParallelExecutionTest.java:40)
%TRACEE

%FAILED 4,test2(junit5.ParallelExecutionTest)
%EXPECTS
expected2
%EXPECTE
%ACTUALS
actual2
%ACTUALE
%TRACES
org.opentest4j.AssertionFailedError: comparison2 failed
    at junit5.ParallelExecutionTest.test1(ParallelExecutionTest.java:48)
%TRACEE

%TESTE  3,test1(junit5.ParallelExecutionTest)
%TESTE  4,test2(junit5.ParallelExecutionTest)

%RUNTIME87        
`;

        analyzer.analyzeData(testRunnerOutput);

        sinon.assert.calledWith(startedSpy, testItem1);
        sinon.assert.calledWith(startedSpy, testItem2);

        // testItem1
        sinon.assert.calledWith(failedSpy, testItem1, sinon.match.any, sinon.match.number);
        sinon.assert.calledWith(failedSpy, testItem1, sinon.match({
            expectedOutput: "expected1", actualOutput: "actual1"
        }));
        sinon.assert.calledWith(failedSpy, testItem1, sinon.match({
            message: sinon.match({
                value: sinon.match(/comparison1/)
            })
        }));

        // testItem2
        sinon.assert.calledWith(failedSpy, testItem2, sinon.match.any, sinon.match.number);
        sinon.assert.calledWith(failedSpy, testItem2, sinon.match({
            expectedOutput: "expected2", actualOutput: "actual2"
        }));
        sinon.assert.calledWith(failedSpy, testItem2, sinon.match({
            message: sinon.match({
                value: sinon.match(/comparison2/)
            })
        }));

    });

});
