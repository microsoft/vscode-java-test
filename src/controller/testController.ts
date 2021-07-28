// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, TestController, TestItem, tests } from 'vscode';
import { isStandardServerReady } from '../extension';
import { loadJavaProjects } from './utils';

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

export async function loadChildren(item: TestItem, token?: CancellationToken): Promise<void> {
    if (!item) {
        await loadJavaProjects();
        return;
    }
    // todo: load other items
}
