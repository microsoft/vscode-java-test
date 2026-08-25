// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { CancellationTokenSource, TestController, TestItem, tests, Uri } from 'vscode';
import { loadChildren } from '../../src/controller/testController';
import { dataCache, invalidateResolutionVersion } from '../../src/controller/testItemDataCache';
import * as controllerUtils from '../../src/controller/utils';
import { TestKind, TestLevel } from '../../src/java-test-runner.api';
import { IJavaTestItem } from '../../src/types';
import { setupTestEnv } from './utils';

function createTestItem(testController: TestController, id: string, testLevel: TestLevel,
    parent?: TestItem, uri?: Uri): TestItem {
    const item: TestItem = testController.createTestItem(id, id, uri);
    item.canResolveChildren = true;
    parent?.children.add(item);
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

    test('should discard stale project discovery after a file is deleted', async () => {
        const uri: Uri = Uri.file('/mock/test/DeletedTest.java');
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        testController.items.add(project);
        const testPackage: TestItem = createTestItem(
            testController, 'project@test', TestLevel.Package, project);
        const deletedClass: TestItem = createTestItem(
            testController, 'project@test.DeletedTest', TestLevel.Class, testPackage, uri);
        let completeStaleSearch!: (items: IJavaTestItem[]) => void;
        let signalStaleSearchStarted!: () => void;
        const staleSearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeStaleSearch = resolve;
        });
        const staleSearchStarted: Promise<void> = new Promise((resolve) => {
            signalStaleSearchStarted = resolve;
        });
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes');
        findTestsStub.onFirstCall().callsFake(() => {
            signalStaleSearchStarted();
            return staleSearch;
        });
        findTestsStub.onSecondCall().resolves([]);

        const resolution: Promise<void> = loadChildren(project);
        await staleSearchStarted;
        controllerUtils.removeOutdatedTestItemsForDocument(testPackage, uri, new Set<string>());
        if (testPackage.children.size === 0) {
            project.children.delete(testPackage.id);
        }
        completeStaleSearch([{
            children: [{
                uri: uri.toString(),
                range: undefined,
                jdtHandler: 'stale-class-handler',
                fullName: 'test.DeletedTest',
                label: 'DeletedTest',
                id: deletedClass.id,
                projectName: 'project',
                testKind: TestKind.JUnit5,
                testLevel: TestLevel.Class,
            }],
            uri: undefined,
            range: undefined,
            jdtHandler: 'stale-package-handler',
            fullName: 'test',
            label: 'test',
            id: testPackage.id,
            projectName: 'project',
            testKind: TestKind.JUnit5,
            testLevel: TestLevel.Package,
        }]);
        await resolution;

        assert.strictEqual(findTestsStub.callCount, 2);
        assert.strictEqual(project.children.get(testPackage.id), undefined);
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

    test('should share a retry after an in-progress resolution is invalidated', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        let completeInitialSearch!: (items: IJavaTestItem[]) => void;
        let completeRetrySearch!: (items: IJavaTestItem[]) => void;
        let signalRetryStarted!: () => void;
        const initialSearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeInitialSearch = resolve;
        });
        const retrySearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeRetrySearch = resolve;
        });
        const retryStarted: Promise<void> = new Promise((resolve) => {
            signalRetryStarted = resolve;
        });
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes');
        findTestsStub.onFirstCall().returns(initialSearch);
        findTestsStub.onSecondCall().callsFake(() => {
            signalRetryStarted();
            return retrySearch;
        });

        const initialResolution: Promise<void> = loadChildren(project);
        const firstWaiter: Promise<void> = loadChildren(project);
        const secondWaiter: Promise<void> = loadChildren(project);
        invalidateResolutionVersion(project);
        completeInitialSearch([]);
        await retryStarted;

        assert.strictEqual(findTestsStub.callCount, 2);

        completeRetrySearch([]);
        await Promise.all([initialResolution, firstWaiter, secondWaiter]);

        assert.strictEqual(findTestsStub.callCount, 2);
        assert.strictEqual(project.canResolveChildren, false);
    });

    test('should retry its own resolution after invalidation', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        let completeInitialSearch!: (items: IJavaTestItem[]) => void;
        const initialSearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeInitialSearch = resolve;
        });
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes');
        findTestsStub.onFirstCall().returns(initialSearch);
        findTestsStub.onSecondCall().resolves([]);

        const resolution: Promise<void> = loadChildren(project);
        invalidateResolutionVersion(project);
        completeInitialSearch([]);
        await resolution;

        assert.strictEqual(findTestsStub.callCount, 2);
        assert.strictEqual(project.canResolveChildren, false);
    });

    test('should coalesce concurrent forced refreshes into the latest resolution', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        project.canResolveChildren = false;
        let completeInitialSearch!: (items: IJavaTestItem[]) => void;
        let completeLatestSearch!: (items: IJavaTestItem[]) => void;
        let signalLatestSearchStarted!: () => void;
        const initialSearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeInitialSearch = resolve;
        });
        const latestSearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeLatestSearch = resolve;
        });
        const latestSearchStarted: Promise<void> = new Promise((resolve) => {
            signalLatestSearchStarted = resolve;
        });
        const findTestsStub = sinon.stub(controllerUtils, 'findTestPackagesAndTypes');
        findTestsStub.onFirstCall().returns(initialSearch);
        findTestsStub.onSecondCall().callsFake(() => {
            signalLatestSearchStarted();
            return latestSearch;
        });

        const firstRefresh: Promise<void> = loadChildren(project, undefined, true);
        const secondRefresh: Promise<void> = loadChildren(project, undefined, true);
        const thirdRefresh: Promise<void> = loadChildren(project, undefined, true);
        completeInitialSearch([]);
        await latestSearchStarted;

        assert.strictEqual(findTestsStub.callCount, 2);

        completeLatestSearch([]);
        await Promise.all([firstRefresh, secondRefresh, thirdRefresh]);

        assert.strictEqual(findTestsStub.callCount, 2);
        assert.strictEqual(project.canResolveChildren, false);
    });

    test('should re-read class metadata when its handler changes during a retry', async () => {
        const project: TestItem = createTestItem(testController, 'project', TestLevel.Project);
        const testClass: TestItem = createTestItem(testController, 'testClass', TestLevel.Class);
        project.children.add(testClass);
        let completeInitialSearch!: (items: IJavaTestItem[]) => void;
        let completeRetrySearch!: (items: IJavaTestItem[]) => void;
        let signalRetryStarted!: () => void;
        const initialSearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeInitialSearch = resolve;
        });
        const retrySearch: Promise<IJavaTestItem[]> = new Promise((resolve) => {
            completeRetrySearch = resolve;
        });
        const retryStarted: Promise<void> = new Promise((resolve) => {
            signalRetryStarted = resolve;
        });
        const findMethodsStub = sinon.stub(controllerUtils, 'findDirectTestChildrenForClass');
        findMethodsStub.onFirstCall().returns(initialSearch);
        findMethodsStub.onSecondCall().callsFake(() => {
            signalRetryStarted();
            return retrySearch;
        });
        findMethodsStub.onThirdCall().resolves([]);

        const resolution: Promise<void> = loadChildren(testClass);
        invalidateResolutionVersion(testClass);
        completeInitialSearch([]);
        await retryStarted;

        controllerUtils.synchronizeItemsRecursively(project, [{
            children: [],
            uri: undefined,
            range: undefined,
            jdtHandler: 'updated-handler',
            fullName: 'testClass',
            label: 'testClass',
            id: 'testClass',
            projectName: 'project',
            testKind: TestKind.JUnit5,
            testLevel: TestLevel.Class,
        }]);
        completeRetrySearch([]);
        await resolution;

        assert.deepStrictEqual(
            findMethodsStub.getCalls().map((call: sinon.SinonSpyCall) => call.args[0]),
            ['testClass-handler', 'testClass-handler', 'updated-handler']);
        assert.strictEqual(testClass.canResolveChildren, false);
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
