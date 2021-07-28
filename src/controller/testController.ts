// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, TestController, TestItem, tests } from 'vscode';
import { instrumentOperation, sendError } from 'vscode-extension-telemetry-wrapper';
import { isStandardServerReady } from '../extension';
import { IJavaTestItem, TestLevel } from '../types';
import { dataCache, ITestItemData } from './testItemDataCache';
import { findDirectTestChildrenForClass, findTestPackagesAndTypes, loadJavaProjects, synchronizeItemsRecursively } from './utils';

export let testController: TestController | undefined;

export function createTestController(): void {
    if (!isStandardServerReady()) {
        return;
    }
    testController?.dispose();
    testController = tests.createTestController('javaTestController', 'Java Test');

    testController.resolveHandler = async (item: TestItem) => {
        await loadChildren(item);
    };
}

export const loadChildren: (item: TestItem, token?: CancellationToken) => any = instrumentOperation('java.test.explorer.loadChildren', async (_operationId: string, item: TestItem, token?: CancellationToken) => {
    if (!item) {
        await loadJavaProjects();
        return;
    }

    const data: ITestItemData | undefined = dataCache.get(item);
    if (!data) {
        return;
    }
    if (data.testLevel === TestLevel.Project) {
        const packageAndTypes: IJavaTestItem[] = await findTestPackagesAndTypes(data.jdtHandler, token);
        synchronizeItemsRecursively(item, packageAndTypes);
    } else if (data.testLevel === TestLevel.Package) {
        // unreachable code
    } else if (data.testLevel === TestLevel.Class) {
        if (!data.jdtHandler) {
            sendError(new Error('The class node does not have jdt handler id.'));
            return;
        }
        const testMethods: IJavaTestItem[] = await findDirectTestChildrenForClass(data.jdtHandler, token);
        synchronizeItemsRecursively(item, testMethods);
    }
});
