// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, DebugConfiguration, Progress, ProgressLocation, Range, TextDocument, Uri, ViewColumn, window, workspace } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { logger } from '../logger/logger';
import { ISearchTestItemParams, ITestItem, TestLevel } from '../protocols';
import { runnerScheduler } from '../runners/runnerScheduler';
import { searchTestItemsAll } from '../utils/commandUtils';
import { constructSearchTestItemParams } from '../utils/protocolUtils';

export async function openTextDocument(uri: Uri, range?: Range): Promise<void> {
    const document: TextDocument = await workspace.openTextDocument(uri);
    await window.showTextDocument(document, {preserveFocus: true, selection: range, viewColumn: ViewColumn.One});
}

export async function runTestsFromExplorer(node?: TestTreeNode, launchConfiguration?: DebugConfiguration): Promise<void> {
    return executeTestsFromExplorer(false /* isDebug */, node, launchConfiguration);
}

export async function debugTestsFromExplorer(node?: TestTreeNode, launchConfiguration?: DebugConfiguration): Promise<void> {
    return executeTestsFromExplorer(true /* isDebug */, node, launchConfiguration);
}

async function executeTestsFromExplorer(isDebug: boolean, node?: TestTreeNode, launchConfiguration?: DebugConfiguration): Promise<void> {
    if (!node) {
        node = new TestTreeNode('', '', TestLevel.Root, '');
    }
    const tests: ITestItem[] = await searchTestItems(node);
    if (tests.length <= 0) {
        logger.info('No test items found.');
        return;
    }

    return runnerScheduler.run(tests, isDebug, node, launchConfiguration);
}

async function searchTestItems(node: TestTreeNode): Promise<ITestItem[]> {
    return new Promise<ITestItem[]>((resolve: (result: ITestItem[]) => void): void => {
        const searchParam: ISearchTestItemParams = constructSearchTestItemParams(node);
        window.withProgress(
            { location: ProgressLocation.Notification, cancellable: true },
            async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                progress.report({ message: 'Searching test items...' });
                const tests: ITestItem[] = await searchTestItemsAll(searchParam);
                if (token.isCancellationRequested) {
                    logger.info('Test job is canceled.');
                    return resolve([]);
                }
                return resolve(tests);
            },
        );
    });
}
