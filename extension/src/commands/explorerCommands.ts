// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, Progress, ProgressLocation, TextDocument, Uri, window, workspace } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { ISearchTestItemParams, ITestItem } from '../protocols';
import { searchTestItemsAll } from '../utils/commandUtils';
import { constructSearchTestItemParams } from '../utils/protocolUtils';
import { executeTests } from './executeTests';

export async function openTextDocumentForNode(node: TestTreeNode): Promise<void> {
    const document: TextDocument = await workspace.openTextDocument(Uri.file(node.fsPath));
    await window.showTextDocument(document, {preserveFocus: true, selection: node.range});
}

export async function runTestsFromExplorer(node?: TestTreeNode): Promise<void> {
    return window.withProgress(
        { location: ProgressLocation.Notification, cancellable: true },
        async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
            progress.report('Searching test items...');
            const searchParam: ISearchTestItemParams = constructSearchTestItemParams(node);
            const tests: ITestItem[] = await searchTestItemsAll(searchParam);
            if (token.isCancellationRequested) {
                return;
            }
            return executeTests(tests, false /* isDebug */, true /* isDefaultConfig */, progress, token);
        },
    );
}
