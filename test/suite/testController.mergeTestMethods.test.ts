// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { TestController, TestItem, tests } from 'vscode';
import { mergeTestMethods } from '../../src/controller/testController';
import { dataCache } from '../../src/controller/testItemDataCache';
import { setupTestEnv } from './utils';
import { TestKind, TestLevel } from '../../src/java-test-runner.api';

function generateTestItem(testController: TestController, id: string, testLevel: TestLevel, uniqueId?: string): TestItem {
    const testItem = testController.createTestItem(id, id + '_label');
    dataCache.set(testItem, {
        jdtHandler: id + '_jdtHandler',
        fullName: id + '_fullName',
        projectName: id + '_projectName',
        testLevel,
        testKind: TestKind.JUnit5,
        uniqueId,
    });
    return testItem;
}

suite('testController - mergeTestMethods', () => {

    let testController: TestController;

    suiteSetup(async function () {
        await setupTestEnv();
    });

    setup(() => {
        testController = tests.createTestController('mergeTestMethodsTestController', 'mergeTestMethodsTestController');
    });

    teardown(() => {
        testController.dispose();
    });

    test('should return the input untouched when empty', () => {
        assert.deepStrictEqual(mergeTestMethods([]), [[]]);
    });

    test('should return the input untouched when a single item is selected', () => {
        const method = generateTestItem(testController, 'id_1', TestLevel.Method);
        assert.deepStrictEqual(mergeTestMethods([method]), [[method]]);
    });

    test('should batch methods of the same class into one launch group', () => {
        const clazz = generateTestItem(testController, 'class_1', TestLevel.Class);
        testController.items.add(clazz);
        const method1 = generateTestItem(testController, 'method_1', TestLevel.Method);
        const method2 = generateTestItem(testController, 'method_2', TestLevel.Method);
        const method3 = generateTestItem(testController, 'method_3', TestLevel.Method);
        clazz.children.add(method1);
        clazz.children.add(method2);
        clazz.children.add(method3);

        // select only 2 of 3 methods - they must share one launch (the core change for issue #1836)
        const result = mergeTestMethods([method1, method2]);

        assert.deepStrictEqual(result, [[], [method1, method2]]);
    });

    test('should upgrade to a class launch when all methods of the class are selected', () => {
        const clazz = generateTestItem(testController, 'class_1', TestLevel.Class);
        testController.items.add(clazz);
        const method1 = generateTestItem(testController, 'method_1', TestLevel.Method);
        const method2 = generateTestItem(testController, 'method_2', TestLevel.Method);
        clazz.children.add(method1);
        clazz.children.add(method2);

        const result = mergeTestMethods([method1, method2]);

        assert.deepStrictEqual(result, [[clazz]]);
    });

    test('should not upgrade to a class launch when any selected method is restricted to a single invocation', () => {
        const clazz = generateTestItem(testController, 'class_1', TestLevel.Class);
        testController.items.add(clazz);
        const method1 = generateTestItem(testController, 'method_1', TestLevel.Method, 'unique_1');
        const method2 = generateTestItem(testController, 'method_2', TestLevel.Method);
        clazz.children.add(method1);
        clazz.children.add(method2);

        const result = mergeTestMethods([method1, method2]);

        // method1 is invocation-restricted -> isolated; method2 batched alone in its own group
        assert.deepStrictEqual(result, [[], [method1], [method2]]);
    });

    test('should isolate uniqueId methods but still batch the remaining methods of the same class', () => {
        const clazz = generateTestItem(testController, 'class_1', TestLevel.Class);
        testController.items.add(clazz);
        const method1 = generateTestItem(testController, 'method_1', TestLevel.Method, 'unique_1');
        const method2 = generateTestItem(testController, 'method_2', TestLevel.Method);
        const method3 = generateTestItem(testController, 'method_3', TestLevel.Method);
        const method4 = generateTestItem(testController, 'method_4', TestLevel.Method);
        clazz.children.add(method1);
        clazz.children.add(method2);
        clazz.children.add(method3);
        clazz.children.add(method4);

        const result = mergeTestMethods([method1, method2, method3]);

        assert.deepStrictEqual(result, [[], [method1], [method2, method3]]);
    });

    test('should keep methods of different parent classes in their own launch groups', () => {
        const classA = generateTestItem(testController, 'class_A', TestLevel.Class);
        const classB = generateTestItem(testController, 'class_B', TestLevel.Class);
        testController.items.add(classA);
        testController.items.add(classB);
        const a1 = generateTestItem(testController, 'a_1', TestLevel.Method);
        const a2 = generateTestItem(testController, 'a_2', TestLevel.Method);
        const b1 = generateTestItem(testController, 'b_1', TestLevel.Method);
        const b2 = generateTestItem(testController, 'b_2', TestLevel.Method);
        classA.children.add(a1);
        classA.children.add(a2);
        // make sure classA still has unselected children so it's not upgraded
        classA.children.add(generateTestItem(testController, 'a_3', TestLevel.Method));
        classB.children.add(b1);
        classB.children.add(b2);
        classB.children.add(generateTestItem(testController, 'b_3', TestLevel.Method));

        const result = mergeTestMethods([a1, b1, a2, b2]);

        assert.deepStrictEqual(result, [[], [a1, a2], [b1, b2]]);
    });

    test('should drop methods whose parent class is also selected', () => {
        const clazz = generateTestItem(testController, 'class_1', TestLevel.Class);
        testController.items.add(clazz);
        const method1 = generateTestItem(testController, 'method_1', TestLevel.Method);
        const method2 = generateTestItem(testController, 'method_2', TestLevel.Method);
        clazz.children.add(method1);
        clazz.children.add(method2);

        const result = mergeTestMethods([clazz, method1]);

        assert.deepStrictEqual(result, [[clazz]]);
    });

    test('should keep multiple selected classes together in the first group', () => {
        const classA = generateTestItem(testController, 'class_A', TestLevel.Class);
        const classB = generateTestItem(testController, 'class_B', TestLevel.Class);
        testController.items.add(classA);
        testController.items.add(classB);

        const result = mergeTestMethods([classA, classB]);

        assert.deepStrictEqual(result, [[classA, classB]]);
    });

    test('should mix class-level and unrelated method-level selections correctly', () => {
        const classA = generateTestItem(testController, 'class_A', TestLevel.Class);
        const classB = generateTestItem(testController, 'class_B', TestLevel.Class);
        testController.items.add(classA);
        testController.items.add(classB);
        const b1 = generateTestItem(testController, 'b_1', TestLevel.Method);
        const b2 = generateTestItem(testController, 'b_2', TestLevel.Method);
        classB.children.add(b1);
        classB.children.add(b2);
        classB.children.add(generateTestItem(testController, 'b_3', TestLevel.Method));

        const result = mergeTestMethods([classA, b1, b2]);

        assert.deepStrictEqual(result, [[classA], [b1, b2]]);
    });
});
