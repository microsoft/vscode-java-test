// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import { TestController, TestRunRequest, tests, workspace } from 'vscode';
import { JUnitRunner } from '../../src/runners/junitRunner/JunitRunner';
import { IRunTestContext, TestKind } from '../../src/types';
import { resolveLaunchConfigurationForRunner } from '../../src/utils/launchUtils';
import { generateTestItem, setupTestEnv } from './utils';

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion
suite('JUnit Runner Analyzer Tests', () => {

    let testController: TestController;

    suiteSetup(async function() {
        await setupTestEnv();
    });

    setup(() => {
        testController = tests.createTestController('testController', 'Mock Test');
    });

    teardown(() => {
        testController.dispose();
    });

    test("test launch configuration", async () => {
        const testItem = generateTestItem(testController, 'junit@junit4.TestAnnotation#shouldPass', TestKind.JUnit, '=junit/src\\/test\\/java=/optional=/true=/=/maven.pomderived=/true=/=/test=/true=/<junit4{TestAnnotation.java[TestAnnotation~shouldPass');
        const testRunRequest = new TestRunRequest([testItem], []);
        const testRun = testController.createTestRun(testRunRequest);
        const runnerContext: IRunTestContext = {
            isDebug: false,
            kind: TestKind.JUnit,
            projectName: 'junit',
            testItems: [testItem],
            testRun: testRun,
            workspaceFolder: workspace.workspaceFolders?.[0]!,
        };
        const junitRunner =  new JUnitRunner(runnerContext);
        const configuration = await resolveLaunchConfigurationForRunner(junitRunner, runnerContext, {
            classPaths: [
                "/a/b/c.jar",
                "/foo/bar.jar"
            ],
            modulePaths: [
                "/test/module.jar",
            ],
            env: {
                test: "test",
            },
            envFile: "${workspaceFolder}/.env",
            sourcePaths: [
                "/a/b/c.jar"
            ],
            preLaunchTask: "test",
        });
        assert.strictEqual(configuration.env.test, "test");
        assert.strictEqual(configuration.envFile, "${workspaceFolder}/.env");
        assert.strictEqual(configuration.sourcePaths[0], "/a/b/c.jar");
        assert.strictEqual(configuration.preLaunchTask, "test");
        assert.strictEqual(configuration.modulePaths[0], "/test/module.jar");
        assert.strictEqual(configuration.classPaths[0], "/a/b/c.jar");
        assert.strictEqual(configuration.classPaths[1], "/foo/bar.jar");
    });
});
