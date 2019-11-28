// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, DebugConfiguration, Progress, ProgressLocation, Range, TextDocument, Uri, ViewColumn, window, workspace } from 'vscode';
import { logger } from '../logger/logger';
import { ITestItem, TestKind, TestLevel } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';
import { testItemModel } from '../testItemModel';

export async function openTextDocument(uri: Uri, range?: Range): Promise<void> {
    const document: TextDocument = await workspace.openTextDocument(uri);
    await window.showTextDocument(document, {preserveFocus: true, selection: range, viewColumn: ViewColumn.One});
}

export async function runTestsFromExplorer(node?: ITestItem, launchConfiguration?: DebugConfiguration): Promise<void> {
    return executeTestsFromExplorer(false /* isDebug */, node, launchConfiguration);
}

export async function debugTestsFromExplorer(node?: ITestItem, launchConfiguration?: DebugConfiguration): Promise<void> {
    return executeTestsFromExplorer(true /* isDebug */, node, launchConfiguration);
}

async function executeTestsFromExplorer(isDebug: boolean, node?: ITestItem, launchConfiguration?: DebugConfiguration): Promise<void> {
    if (!node) {
        // TODO: Should save necessary information in runnerContext instead of passing the complicated node instance!
        node = {
            id: '',
            displayName: '',
            fullName: '',
            children: undefined,
            kind: TestKind.None,
            project: '',
            level: TestLevel.Root,
            paramTypes: [],
            location: {
                uri: '',
                range: new Range(0, 0, 0, 0),
            },
        };
    }

    const runnerContext: IRunnerContext = {
        scope: node.level,
        testUri: '',
        fullName: '',
        projectName: '',
        isDebug,
    };

    if (node.level === TestLevel.Package || node.level === TestLevel.Class || node.level === TestLevel.Method) {
        runnerContext.testUri = Uri.parse(node.location.uri).toString();
        runnerContext.fullName = node.fullName;
    }
    const tests: ITestItem[] | undefined = await searchTestItems(node);
    if (!tests) {
        logger.info('Test job is canceled.');
        return;
    } else if (tests.length <= 0) {
        logger.info('No test items found.');
        return;
    }

    return runnerScheduler.run(tests, runnerContext, launchConfiguration);
}

async function searchTestItems(node: ITestItem): Promise<ITestItem[] | undefined> {
    return new Promise<ITestItem[] | undefined>((resolve: (result: ITestItem[] | undefined) => void): void => {
        window.withProgress(
            { location: ProgressLocation.Notification, cancellable: true },
            async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                progress.report({ message: 'Searching test items...' });
                token.onCancellationRequested(() => resolve(undefined));
                const tests: ITestItem[] = await testItemModel.getAllNodes(node);
                if (token.isCancellationRequested) {
                    return resolve(undefined);
                }
                return resolve(tests);
            },
        );
    });
}
