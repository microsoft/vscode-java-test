// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { TestController, TestMessage, TestRunRequest, tests, workspace } from 'vscode';
import { TestNGRunnerResultAnalyzer } from '../../src/runners/testngRunner/TestNGRunnerResultAnalyzer';
import { IRunTestContext, TestKind, TestLevel } from '../../src/java-test-runner.api';
import { generateTestItem } from './utils';
import { dataCache } from '../../src/controller/testItemDataCache';

// tslint:disable: only-arrow-functions
suite('TestNG Runner Analyzer Tests', () => {

    let testController: TestController;

    setup(() => {
        testController = tests.createTestController('testngTestController', 'Mock TestNG');
    });

    teardown(() => {
        testController.dispose();
    });

    test('surfaces runner errors as structured test errors', () => {
        const testItem = generateTestItem(testController, 'testng@example.SampleTest#test', TestKind.TestNG);
        const testRun = testController.createTestRun(new TestRunRequest([testItem], []));
        const erroredSpy = sinon.spy(testRun, 'errored');
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.TestNG,
            projectName: 'testng',
            testItems: [testItem],
            testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        const analyzer = new TestNGRunnerResultAnalyzer(runnerContext);
        const trace = 'java.lang.ClassNotFoundException: example.SampleTest';

        analyzer.processData(JSON.stringify({
            name: 'error',
            attributes: {
                message: 'Failed to run TestNG tests',
                trace,
            },
        }));

        sinon.assert.calledOnce(erroredSpy);
        sinon.assert.calledWith(erroredSpy, testItem, sinon.match.instanceOf(TestMessage));
        const testMessage = erroredSpy.firstCall.args[1] as TestMessage;
        assert.strictEqual(testMessage.message, `Failed to run TestNG tests\n${trace}`);
    });

    test('ignores control messages without test attributes', () => {
        const testItem = generateTestItem(testController, 'testng@example.SampleTest#test', TestKind.TestNG);
        const testRun = testController.createTestRun(new TestRunRequest([testItem], []));
        const appendOutputSpy = sinon.spy(testRun, 'appendOutput');
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.TestNG,
            projectName: 'testng',
            testItems: [testItem],
            testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        const analyzer = new TestNGRunnerResultAnalyzer(runnerContext);

        analyzer.analyzeData('@@<TestRunner-{"name":"reporterAttached"}-TestRunner>');

        sinon.assert.notCalled(appendOutputSpy);
    });

    test('reports method results without assigning a result state to the class', () => {
        const classItem = testController.createTestItem('testng@example.SampleTest', 'SampleTest');
        dataCache.set(classItem, {
            jdtHandler: '',
            fullName: 'example.SampleTest',
            projectName: 'testng',
            testLevel: TestLevel.Class,
            testKind: TestKind.TestNG,
        });
        const testItem = generateTestItem(testController, 'testng@example.SampleTest#test', TestKind.TestNG);
        classItem.children.add(testItem);

        const testRun = testController.createTestRun(new TestRunRequest([classItem], []));
        const enqueuedSpy = sinon.spy(testRun, 'enqueued');
        const startedSpy = sinon.spy(testRun, 'started');
        const passedSpy = sinon.spy(testRun, 'passed');
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.TestNG,
            projectName: 'testng',
            testItems: [classItem],
            testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        const analyzer = new TestNGRunnerResultAnalyzer(runnerContext);

        analyzer.processData(JSON.stringify({
            name: 'testStarted',
            attributes: { name: 'example.SampleTest#test' },
        }));
        analyzer.processData(JSON.stringify({
            name: 'testFinished',
            attributes: { name: 'example.SampleTest#test', duration: '10' },
        }));

        sinon.assert.calledWith(enqueuedSpy, testItem);
        assert.strictEqual(enqueuedSpy.calledWith(classItem), false);
        sinon.assert.calledWith(startedSpy, testItem);
        sinon.assert.calledWith(passedSpy, testItem, 10);
        assert.strictEqual(startedSpy.calledWith(classItem), false);
        assert.strictEqual(passedSpy.calledWith(classItem), false);
    });

    test('reports runner errors on method cases instead of their class', () => {
        const classItem = testController.createTestItem('testng@example.SampleTest', 'SampleTest');
        dataCache.set(classItem, {
            jdtHandler: '',
            fullName: 'example.SampleTest',
            projectName: 'testng',
            testLevel: TestLevel.Class,
            testKind: TestKind.TestNG,
        });
        const testItem = generateTestItem(testController, 'testng@example.SampleTest#test', TestKind.TestNG);
        classItem.children.add(testItem);

        const testRun = testController.createTestRun(new TestRunRequest([classItem], []));
        const erroredSpy = sinon.spy(testRun, 'errored');
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.TestNG,
            projectName: 'testng',
            testItems: [classItem],
            testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        const analyzer = new TestNGRunnerResultAnalyzer(runnerContext);

        analyzer.processData(JSON.stringify({
            name: 'error',
            attributes: { message: 'Failed to run TestNG tests' },
        }));

        sinon.assert.calledWith(erroredSpy, testItem, sinon.match.instanceOf(TestMessage));
        assert.strictEqual(erroredSpy.calledWith(classItem), false);
    });
});
