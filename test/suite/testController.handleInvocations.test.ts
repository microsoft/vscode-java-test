import * as assert from 'assert';
import * as sinon from 'sinon';
import { TestController, TestItem, tests, window } from "vscode";
import { INVOCATION_PREFIX } from '../../src/constants';
import { handleInvocations } from '../../src/controller/testController';
import { dataCache } from "../../src/controller/testItemDataCache";
import { TestKind, TestLevel } from "../../src/types";
import { setupTestEnv } from './utils';

function generateTestItem(testController: TestController, id: string, testKind: TestKind, testLevel: TestLevel, uniqueId?: string): TestItem {
    id = testLevel === TestLevel.Invocation ? INVOCATION_PREFIX + id : id;
    const testItem = testController.createTestItem(id, id + '_label');
    dataCache.set(testItem, {
        jdtHandler: id + '_jdtHandler',
        fullName: id + '_fullName',
        projectName: id + '_projectName',
        testLevel,
        testKind,
        uniqueId
    });

    return testItem;
}


suite("testController - TestItem run preparation: handleInvocations", () => {

    let testController: TestController;

    suiteSetup(async function () {
        await setupTestEnv();
    });

    setup(() => {
        testController = tests.createTestController('testController', 'testController');
    });

    teardown(() => {
        testController.dispose();
    });

    test("should not do anything when no TestItems are selected", () => {
        assert.deepStrictEqual(handleInvocations([]), []);
    });

    test("should not do anything when no JUnit5 invocations are selected", () => {
        const selected: TestItem[] = [
            generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method),
            generateTestItem(testController, 'id_2', TestKind.JUnit5, TestLevel.Method)
        ];
        assert.deepStrictEqual(handleInvocations(selected), selected);
    });

    test("should show an error when multiple - but not all - JUnit5 invocations of a method are selected", () => {

        const method = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method); // needed to properly sync children
        const invocation1 = generateTestItem(testController, 'id_2', TestKind.JUnit5, TestLevel.Invocation);
        const invocation2 = generateTestItem(testController, 'id_3', TestKind.JUnit5, TestLevel.Invocation);
        const invocation3 = generateTestItem(testController, 'id_4', TestKind.JUnit5, TestLevel.Invocation);
        method.children.add(invocation1);
        method.children.add(invocation2);
        method.children.add(invocation3);

        const showErrorStub = sinon.stub(window, 'showErrorMessage');

        const result = handleInvocations([invocation1, invocation2]);

        assert.deepStrictEqual(result, []);
        assert.ok(showErrorStub.calledOnce);
    });

    test("should replace a JUnit5 invocation by a corresponding parent method call with restriction to the specific invocation re-run", () => {

        const method = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method);
        const invocation1_1 = generateTestItem(testController, 'id_1_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId_1_1');
        const invocation1_2 = generateTestItem(testController, 'id_1_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId_1_2');
        method.children.add(invocation1_1);
        method.children.add(invocation1_2);

        const result = handleInvocations([invocation1_1]);

        assert.deepStrictEqual(result, [method]);
        assert.deepStrictEqual(dataCache.get(method)?.uniqueId, 'inv_uniqueId_1_1'); // restrict to single invocation re-run
    });

    test("should replace JUnit5 invocations by the parent method call without restriction when all invocations are selected", () => {

        const method = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method);
        const invocation = generateTestItem(testController, 'id_1_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId_1_1');
        method.children.add(invocation);

        const result = handleInvocations([invocation]);

        assert.deepStrictEqual(result, [method]);
        assert.deepStrictEqual(dataCache.get(method)?.uniqueId, undefined); // no restriction
    });

    test("should replace multiple JUnit5 invocations by the different parent method calls with restrictions", () => {

        const method1 = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method1);
        const invocation1_1 = generateTestItem(testController, 'id_1_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_1');
        const invocation1_2 = generateTestItem(testController, 'id_1_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_2');
        method1.children.add(invocation1_1);
        method1.children.add(invocation1_2);

        const method2 = generateTestItem(testController, 'id_2', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method2);
        const invocation2_1 = generateTestItem(testController, 'id_2_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId2_1');
        const invocation2_2 = generateTestItem(testController, 'id_2_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId2_2');
        method2.children.add(invocation2_1);
        method2.children.add(invocation2_2);

        const result = handleInvocations([invocation1_1, invocation2_2]);

        assert.deepStrictEqual(result, [method1, method2]);
        assert.deepStrictEqual(dataCache.get(method1)?.uniqueId, 'inv_uniqueId1_1');
        assert.deepStrictEqual(dataCache.get(method2)?.uniqueId, 'inv_uniqueId2_2');
    });

    test("should remove JUnit5 invocations when no single invocation of a method is re-run", () => {

        const method1 = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method1);
        const invocation1_1 = generateTestItem(testController, 'id_1_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_1');
        const invocation1_2 = generateTestItem(testController, 'id_1_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_2');
        method1.children.add(invocation1_1);
        method1.children.add(invocation1_2);
        assert.strictEqual(method1.children.size, 2);

        const method2 = generateTestItem(testController, 'id_2', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method2);
        const invocation2_1 = generateTestItem(testController, 'id_2_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId2_1');
        const invocation2_2 = generateTestItem(testController, 'id_2_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId2_2');
        method2.children.add(invocation2_1);
        method2.children.add(invocation2_2);
        assert.strictEqual(method2.children.size, 2);

        const result = handleInvocations([invocation1_1, method2]);

        assert.deepStrictEqual(result, [method1, method2]);
        assert.deepStrictEqual(dataCache.get(method1)?.uniqueId, 'inv_uniqueId1_1');
        assert.strictEqual(method1.children.size, 2); // no invocations removed
        assert.deepStrictEqual(dataCache.get(method2)?.uniqueId, undefined);
        assert.strictEqual(method2.children.size, 0); // all invocations removed
    });

    test("should not consider invocations when a parent-item is also selected for re-run", () => {

        const method1 = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        testController.items.add(method1);
        const invocation1_1 = generateTestItem(testController, 'id_1_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_1');
        const invocation1_2 = generateTestItem(testController, 'id_1_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_2');
        method1.children.add(invocation1_1);
        method1.children.add(invocation1_2);

        const result = handleInvocations([invocation1_1, method1]);

        assert.deepStrictEqual(result, [method1]);
        assert.deepStrictEqual(dataCache.get(method1)?.uniqueId, undefined);
    });

    test("should not consider invocations when a grand-parent-item is also selected for re-run", () => {

        const class1 = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Class);
        testController.items.add(class1);
        const method1_1 = generateTestItem(testController, 'id_1_1', TestKind.JUnit5, TestLevel.Method);
        class1.children.add(method1_1);
        const invocation1_1_1 = generateTestItem(testController, 'id_1_1_1', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_1_1');
        const invocation1_1_2 = generateTestItem(testController, 'id_1_1_2', TestKind.JUnit5, TestLevel.Invocation, 'inv_uniqueId1_1_2');
        method1_1.children.add(invocation1_1_1);
        method1_1.children.add(invocation1_1_2);

        const result = handleInvocations([invocation1_1_1, class1]);

        assert.deepStrictEqual(result, [class1]);
        assert.deepStrictEqual(dataCache.get(class1)?.uniqueId, undefined);
        assert.deepStrictEqual(dataCache.get(method1_1)?.uniqueId, undefined);
    });

    test("should clear previously set restrictions for re-running single invocations", () => {
        const method1 = generateTestItem(testController, 'id_1', TestKind.JUnit5, TestLevel.Method);
        dataCache.get(method1)!.uniqueId = 'previously_set_restriction_to_single_invocation_uniqueId';

        const result = handleInvocations([method1]);

        assert.deepStrictEqual(result, [method1]);
        assert.strictEqual(dataCache.get(method1)!.uniqueId, undefined);
    });

});
