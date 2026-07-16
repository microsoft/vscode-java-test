// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { TestController, TestMessage, TestRunRequest, tests, workspace } from 'vscode';
import { TestNGRunnerResultAnalyzer } from '../../src/runners/testngRunner/TestNGRunnerResultAnalyzer';
import { IRunTestContext, TestKind } from '../../src/java-test-runner.api';
import { generateTestItem } from './utils';

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
});
