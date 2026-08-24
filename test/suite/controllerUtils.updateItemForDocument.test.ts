// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { TestController, TestItem, tests, Uri } from 'vscode';
import { markTestClassesResolvedRecursively, removeOutdatedTestItemsForDocument } from '../../src/controller/utils';
import { dataCache, getResolutionVersion } from '../../src/controller/testItemDataCache';
import { TestKind, TestLevel } from '../../src/java-test-runner.api';

function createTestItem(testController: TestController, id: string, testLevel: TestLevel,
    parent?: TestItem, uri?: Uri): TestItem {
    const item: TestItem = testController.createTestItem(id, id, uri);
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

suite('controllerUtils - updateItemForDocument', () => {

    let testController: TestController;

    setup(() => {
        testController = tests.createTestController(
            'updateItemForDocumentTestController', 'updateItemForDocumentTestController');
    });

    teardown(() => {
        testController.dispose();
    });

    test('should remove an outdated class from the same document', async () => {
        const uri: Uri = Uri.file('/mock/test/RenamedTest.java');
        const project: TestItem = createTestItem(
            testController, 'document-update-project', TestLevel.Project);
        testController.items.add(project);
        const oldPackage: TestItem = createTestItem(
            testController, 'document-update-project@old.package', TestLevel.Package, project);
        const newPackage: TestItem = createTestItem(
            testController, 'document-update-project@new.package', TestLevel.Package, project);
        const oldClass: TestItem = createTestItem(
            testController, 'document-update-project@old.package.OldTest', TestLevel.Class, oldPackage, uri);
        const nestedClass: TestItem = createTestItem(
            testController, 'document-update-project@old.package.OldTest$NestedTest',
            TestLevel.Class, oldClass, uri);
        assert.strictEqual(oldClass.uri?.toString(), uri.toString());
        const projectVersion: number = getResolutionVersion(project);
        const oldClassVersion: number = getResolutionVersion(oldClass);
        const nestedClassVersion: number = getResolutionVersion(nestedClass);

        removeOutdatedTestItemsForDocument(
            newPackage, uri, new Set(['document-update-project@new.package.NewTest']));

        assert.strictEqual(project.children.get(oldPackage.id), undefined);
        assert.ok(project.children.get(newPackage.id));
        assert.strictEqual(getResolutionVersion(project), projectVersion + 1);
        assert.strictEqual(getResolutionVersion(oldClass), oldClassVersion + 1);
        assert.strictEqual(getResolutionVersion(nestedClass), nestedClassVersion + 1);
    });

    test('should mark top-level and nested classes as resolved', () => {
        const testClass: TestItem = createTestItem(
            testController, 'document-update-project@test.TestClass', TestLevel.Class);
        const nestedClass: TestItem = createTestItem(
            testController, 'document-update-project@test.TestClass$NestedTest', TestLevel.Class, testClass);
        testClass.canResolveChildren = true;
        nestedClass.canResolveChildren = true;

        markTestClassesResolvedRecursively(testClass);

        assert.strictEqual(testClass.canResolveChildren, false);
        assert.strictEqual(nestedClass.canResolveChildren, false);
    });
});
