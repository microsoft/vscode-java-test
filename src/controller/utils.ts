// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { CancellationToken, Range, TestItem, Uri, workspace, WorkspaceFolder } from 'vscode';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { IJavaTestItem, TestLevel } from '../types';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import { testController } from './testController';
import { dataCache } from './testItemDataCache';

/**
 * Load the Java projects, which are the root nodes of the test explorer
 */
export async function loadJavaProjects(): Promise<void> {
    for (const workspaceFolder of workspace.workspaceFolders || [] ) {
        const testProjects: IJavaTestItem[] = await getJavaProjects(workspaceFolder);
        for (const project of testProjects) {
            if (testController?.items.get(project.id)) {
                continue;
            }
            const projectItem: TestItem = createTestItem(project);
            projectItem.canResolveChildren = true;
            testController?.items.add(projectItem);
        }
    }
}

/**
 * Create test item which will be shown in the test explorer
 * @param metaInfo The data from the server side of the test item
 * @param parent The parent node of the test item (if it has)
 * @returns The created test item
 */
export function createTestItem(metaInfo: IJavaTestItem, parent?: TestItem): TestItem {
    if (!testController) {
        throw new Error('Failed to create test item. The test controller is not initialized.');
    }
    const item: TestItem = testController.createTestItem(
        metaInfo.id,
        metaInfo.label,
        metaInfo.uri ? Uri.parse(metaInfo.uri) : undefined,
    );
    item.range = asRange(metaInfo.range);
    if (metaInfo.testLevel !== TestLevel.Invocation) {
        dataCache.set(item, {
            jdtHandler: metaInfo.jdtHandler,
            fullName: metaInfo.fullName,
            projectName: metaInfo.projectName,
            testLevel: metaInfo.testLevel,
            testKind: metaInfo.testKind,
        });
    }
    if (parent) {
        parent.children.add(item);
    }
    return item;
}

/**
 * Parse the range object with server mode to client format
 * @param range range with server side format
 */
export function asRange(range: any): Range | undefined {
    if (!range) {
        return undefined;
    }
    return new Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

export async function getJavaProjects(workspaceFolder: WorkspaceFolder, token?: CancellationToken): Promise<IJavaTestItem[]> {
    return await executeJavaLanguageServerCommand<IJavaTestItem[]>(
        JavaTestRunnerDelegateCommands.FIND_JAVA_PROJECTS, workspaceFolder.uri.toString(), token) || [];
}
