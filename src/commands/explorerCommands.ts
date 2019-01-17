// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, Progress, ProgressLocation, Range, TextDocument, Uri, ViewColumn, window, workspace } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { logger } from '../logger/logger';
import { ISearchTestItemParams, ITestItem } from '../protocols';
import { runnerExecutor } from '../runners/runnerExecutor';
import { searchTestItemsAll } from '../utils/commandUtils';
import { constructSearchTestItemParams } from '../utils/protocolUtils';

export async function openTextDocument(uri: Uri, range?: Range): Promise<void> {
    const document: TextDocument = await workspace.openTextDocument(uri);
    await window.showTextDocument(document, {preserveFocus: true, selection: range, viewColumn: ViewColumn.One});
}

export async function runTestsFromExplorer(node?: TestTreeNode): Promise<void> {
    return executeTestsFromExplorer(false /* isDebug */, node);
}

export async function debugTestsFromExplorer(node?: TestTreeNode): Promise<void> {
    return executeTestsFromExplorer(true /* isDebug */, node);
}

async function executeTestsFromExplorer(isDebug: boolean, node?: TestTreeNode): Promise<void> {
    let tests: ITestItem[] = [];
    await window.withProgress(
        { location: ProgressLocation.Notification, cancellable: true },
        async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
            progress.report({ message: 'Searching test items...' });
            const searchParam: ISearchTestItemParams = constructSearchTestItemParams(node);
            tests = await searchTestItemsAll(searchParam);
            if (token.isCancellationRequested) {
                tests = [];
                logger.info('Test job is canceled.');
                return;
            }
            if (tests.length === 0) {
                logger.info('No test items found.');
                return;
            }
        },
    );
    if (tests.length > 0) {
        return runnerExecutor.run(tests, isDebug);
    }
}
