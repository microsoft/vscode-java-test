// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { TestController, TestItem, tests, Uri } from 'vscode';
import { removeOutdatedTestItemsForDocument } from '../../src/controller/utils';
import { getResolutionVersion } from '../../src/controller/testItemDataCache';

function createTestItem(testController: TestController, id: string, parent?: TestItem, uri?: Uri): TestItem {
    const item: TestItem = testController.createTestItem(id, id, uri);
    parent?.children.add(item);
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
        const project: TestItem = createTestItem(testController, 'document-update-project');
        testController.items.add(project);
        const oldPackage: TestItem = createTestItem(
            testController, 'document-update-project@old.package', project);
        const newPackage: TestItem = createTestItem(
            testController, 'document-update-project@new.package', project);
        const oldClass: TestItem = createTestItem(
            testController, 'document-update-project@old.package.OldTest', oldPackage, uri);
        const nestedClass: TestItem = createTestItem(
            testController, 'document-update-project@old.package.OldTest$NestedTest', oldClass, uri);
        assert.strictEqual(oldClass.uri?.toString(), uri.toString());
        const oldClassVersion: number = getResolutionVersion(oldClass);
        const nestedClassVersion: number = getResolutionVersion(nestedClass);

        removeOutdatedTestItemsForDocument(
            newPackage, uri, new Set(['document-update-project@new.package.NewTest']));

        assert.strictEqual(project.children.get(oldPackage.id), undefined);
        assert.ok(project.children.get(newPackage.id));
        assert.strictEqual(getResolutionVersion(oldClass), oldClassVersion + 1);
        assert.strictEqual(getResolutionVersion(nestedClass), nestedClassVersion + 1);
    });
});
