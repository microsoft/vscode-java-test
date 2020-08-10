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
    const runnerContext: IRunnerContext = {
        scope: TestLevel.Root,
        testUri: '',
        fullName: '',
        projectName: '',
        kind: TestKind.None,
        isDebug,
        tests: [],
    };
    if (node) {
        runnerContext.scope = node.level;
        runnerContext.projectName = node.project;
        runnerContext.testUri = Uri.parse(node.location.uri).toString();
        if (node.level >= TestLevel.Package) {
            runnerContext.fullName = node.fullName;
        }
        if (node.level === TestLevel.Method) {
            runnerContext.tests = [node];
        }
    }

    if (runnerContext.tests.length === 0) {
        try {
            await searchTestItems(runnerContext);
        } catch (e) {
            // so far the promise is only rejected on cancellation
            logger.info('Test job is canceled.\n');
            return;
        }
    }

    if (runnerContext.tests.length === 0) {
        logger.info('No test items found.\n');
        return;
    }

    return runnerScheduler.run(runnerContext, launchConfiguration);
}

async function searchTestItems(runnerContext: IRunnerContext): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: () => void): void => {
        window.withProgress(
            { location: ProgressLocation.Notification, cancellable: true },
            async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                progress.report({ message: 'Searching test items...' });
                token.onCancellationRequested(reject);
                runnerContext.tests = await testItemModel.getAllNodes(runnerContext.scope, runnerContext.fullName, runnerContext.testUri);
                if (token.isCancellationRequested) {
                    return reject();
                }
                return resolve();
            },
        );
    });
}
