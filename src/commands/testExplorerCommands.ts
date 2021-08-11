// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration, TestItem, TestRunRequest } from 'vscode';
import { runTests, testController } from '../controller/testController';
import { loadJavaProjects } from '../controller/utils';
import { showTestItemsInCurrentFile } from '../extension';

/**
 * This function is used to exposed as a command, which other extensions can trigger
 * their customized run/debug requests to test runner. (e.g. the PDE extension)
 *
 * Note that, the test item in the method parameters is not the exact test item in the test explorer (another instance).
 * To get the metadata of the real test item, we have to record the path from test item to root, and then trace back that
 * path to get the real one.
 */
export async function runTestsFromTestExplorer(testItem: TestItem, launchConfiguration: DebugConfiguration, isDebug: boolean): Promise<void> {
    const pathToRoot: string[] = [];
    do {
        pathToRoot.push(testItem.id);
        testItem = testItem.parent!;
    } while (testItem);
    let currentItem: TestItem | undefined = testController?.items.get(pathToRoot.pop()!);
    if (!currentItem) {
        return;
    }
    while (pathToRoot.length) {
        const id: string = pathToRoot.pop()!;
        currentItem = currentItem.children.get(id);
        if (!currentItem) {
            return;
        }
    }
    const request: TestRunRequest = new TestRunRequest([currentItem], undefined);

    await runTests(request, { launchConfiguration, isDebug });
}

export async function refresh(): Promise<void> {
    testController?.items.forEach((root: TestItem) => {
        testController?.items.delete(root.id);
    });

    await loadJavaProjects();
    await showTestItemsInCurrentFile();
}
