// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { CancellationTokenSource, TestController, TestItem, tests } from 'vscode';
import { loadChildren } from '../../src/controller/testController';
import { dataCache } from '../../src/controller/testItemDataCache';
import * as controllerUtils from '../../src/controller/utils';
import { TestKind, TestLevel } from '../../src/java-test-runner.api';
import { IJavaTestItem } from '../../src/types';
import { setupTestEnv } from './utils';

function createTestItem(testController: TestController, id: string, testLevel: TestLevel): TestItem {
    const item: TestItem = testController.createTestItem(id, id);
    item.canResolveChildren = true;
    dataCache.set(item, {
        jdtHandler: `${id}-handler`,
        fullName: id,
        projectName: 'project',
        testLevel,
        testKind: TestKind.JUnit5,
    });
    return item;
}

suite('testController - loadChildren', () => {

    let testController: TestController;

    suiteSetup(async function () {
        await setupTestEnv();
    });

    setup(() => {
        testController = tests.createTestController('loadChildrenTestController', 'loadChildrenTestController');
    });

    teardown(() => {
        sinon.restore();
        testController.dispose();
    });

    test('should reuse resolved project children until a forced refresh', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes').resolves([]);

        await loadChildren(project);
        await loadChildren(project);

        assert.ok(findTestsStub.calledOnce);
        assert.strictEqual(project.canResolveChildren, false);

        await loadChildren(project, undefined, true);

        assert.ok(findTestsStub.calledTwice);
        assert.strictEqual(project.canResolveChildren, false);
    });

    test('should share an in-progress project resolution', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        let completeSearch!: (items: IJavaTestItem[]) => void;
        const searchResult: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeSearch = resolve;
        });
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes').returns(searchResult);

        const firstResolution: Promise<void> = loadChildren(project);
        const secondResolution: Promise<void> = loadChildren(project);
        completeSearch([]);
        await Promise.all([firstResolution, secondResolution]);

        assert.ok(findTestsStub.calledOnce);
        assert.strictEqual(project.canResolveChildren, false);
    });

    test('should reuse resolved class children', async () => {
        const testClass: TestItem = createTestItem(testController, 'testClass', TestLevel.Class);
        const findMethodsStub = sinon.stub(controllerUtils, 'findDirectTestChildrenForClass').resolves([]);

        await loadChildren(testClass);
        await loadChildren(testClass);

        assert.ok(findMethodsStub.calledOnce);
        assert.strictEqual(testClass.canResolveChildren, false);
    });

    test('should invalidate descendant resolutions during a forced refresh', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        const testClass: TestItem = createTestItem(testController, 'testClass', TestLevel.Class);
        project.children.add(testClass);
        let completeMethodSearch!: (items: IJavaTestItem[]) => void;
        sinon.stub(controllerUtils, 'findDirectTestChildrenForClass').returns(new Promise((resolve) => {
            completeMethodSearch = resolve;
        }));
        sinon.stub(controllerUtils, 'findTestPackagesAndTypes').resolves([{
            children: [],
            uri: undefined,
            range: undefined,
            jdtHandler: 'testClass-handler',
            fullName: 'testClass',
            label: 'testClass',
            id: 'testClass',
            projectName: 'project',
            testKind: TestKind.JUnit5,
            testLevel: TestLevel.Class,
        }]);

        const staleClassResolution: Promise<void> = loadChildren(testClass);
        await loadChildren(project, undefined, true);
        completeMethodSearch([{
            children: [],
            uri: undefined,
            range: undefined,
            jdtHandler: 'staleMethod-handler',
            fullName: 'staleMethod',
            label: 'staleMethod',
            id: 'staleMethod',
            projectName: 'project',
            testKind: TestKind.JUnit5,
            testLevel: TestLevel.Method,
        }]);
        await staleClassResolution;

        assert.strictEqual(project.canResolveChildren, false);
        assert.strictEqual(testClass.canResolveChildren, true);
        assert.strictEqual(testClass.children.get('staleMethod'), undefined);
    });

    test('should leave a cancelled item unresolved', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        const source: CancellationTokenSource = new CancellationTokenSource();
        source.cancel();
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes').resolves([]);

        await loadChildren(project, source.token);

        assert.ok(findTestsStub.notCalled);
        assert.strictEqual(project.canResolveChildren, true);
        source.dispose();
    });
});
