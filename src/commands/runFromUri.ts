// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { Uri, window, workspace } from 'vscode';
import { IProgressReporter } from '../debugger.api';
import { progressProvider } from '../extension';
import { ITestItem, TestLevel } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';
import { testItemModel } from '../testItemModel';

export async function executeTestsFromUri(uri: Uri | undefined, progressReporter: IProgressReporter | undefined, isDebug: boolean): Promise<void> {
    if (!uri) {
        if (!window.activeTextEditor) {
            return;
        }
        uri = window.activeTextEditor.document.uri;
    }

    if (uri.scheme !== 'file' || path.extname(uri.fsPath) !== '.java') {
        return;
    }

    if (!workspace.getWorkspaceFolder(uri)) {
        window.showInformationMessage(`The file: '${uri.fsPath}' does not belong to the current workspace.`);
        return;
    }

    progressReporter = progressReporter || progressProvider?.createProgressReporter(isDebug ? 'Debug Test' : 'Run Test');

    progressReporter?.report('Searching tests...');

    const tests: ITestItem[] = await testItemModel.getItemsForCodeLens(uri);
    const testItemForPrimaryType: ITestItem | undefined = tests.find((test: ITestItem) => {
        return test.level === TestLevel.Class;
    });

    if (!testItemForPrimaryType) {
        window.showInformationMessage(`No tests in file: '${uri.fsPath}'.`);
        progressReporter?.done();
        return;
    }

    const runnerContext: IRunnerContext = {
        scope: testItemForPrimaryType.level,
        testUri: testItemForPrimaryType.location.uri,
        fullName: testItemForPrimaryType.fullName,
        kind: testItemForPrimaryType.kind,
        projectName: testItemForPrimaryType.project,
        tests: [testItemForPrimaryType],
        isDebug,
    };

    await runnerScheduler.run(runnerContext, progressReporter);
}
