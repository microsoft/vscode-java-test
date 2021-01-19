// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, DebugConfiguration, Progress, ProgressLocation, Range, TextDocument, Uri, ViewColumn, window, workspace } from 'vscode';
import { IProgressReporter } from '../debugger.api';
import { progressProvider } from '../extension';
import { logger } from '../logger/logger';
import { ITestItem, TestKind, TestLevel } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';
import { testItemModel } from '../testItemModel';
import { executeTestsFromUri } from './runFromUri';

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
    return executeTests(runnerContext, launchConfiguration);
}

export async function runTestsFromJavaProjectExplorer(node: any, isDebug: boolean): Promise<void> {
    if (node._nodeData.kind === 6 /*PrimaryType*/) {
        return executeTestsFromUri(Uri.parse(node._nodeData.uri), undefined, isDebug);
    }

    const runnerContext: IRunnerContext = {
        scope: TestLevel.Package,
        testUri: node._nodeData.uri,
        fullName: node._nodeData.name,
        projectName: node._project.name,
        kind: TestKind.None,
        isDebug,
        tests: [],
        // isPackage is only available when the explorer is in hierarchical mode
        isHierarchicalPackage: node._nodeData.isPackage,
    };

    return executeTests(runnerContext);
}

async function executeTests(runnerContext: IRunnerContext, launchConfiguration?: DebugConfiguration): Promise<void> {
    const progressReporter: IProgressReporter | undefined = progressProvider?.createProgressReporter(runnerContext.isDebug ? 'Debug Test' : 'Run Test', ProgressLocation.Notification, true);
    if (runnerContext.tests.length === 0) {
        try {
            await searchTestItems(runnerContext, progressReporter);
        } catch (e) {
            // so far the promise is only rejected on cancellation
            logger.info('Test job is canceled.\n');
            progressReporter?.done();
            return;
        }
    }

    if (runnerContext.tests.length === 0) {
        window.showInformationMessage(`No tests found under: '${Uri.parse(runnerContext.testUri).fsPath}'.`);
        progressReporter?.done();
        return;
    }

    return runnerScheduler.run(runnerContext, progressReporter, launchConfiguration);
}

async function searchTestItems(runnerContext: IRunnerContext, progressReporter?: IProgressReporter): Promise<void> {
    return new Promise<void>(async (resolve: () => void, reject: () => void): Promise<void> => {
        const searchImpl: (token: CancellationToken) => Promise<void> = async (token: CancellationToken) => {
            token.onCancellationRequested(reject);
            runnerContext.tests = await testItemModel.getAllNodes(runnerContext.scope, runnerContext.fullName, runnerContext.testUri, runnerContext.isHierarchicalPackage, token);
            return resolve();
        };

        if (progressReporter) {
            progressReporter.report('Searching tests...');
            return searchImpl(progressReporter.getCancellationToken());
        } else {
            window.withProgress(
                { location: ProgressLocation.Notification, cancellable: true },
                async (progress: Progress<any>, token: CancellationToken): Promise<void> => {
                    progress.report({ message: 'Searching tests...' });
                    return searchImpl(token);
                },
            );
        }
    });
}
