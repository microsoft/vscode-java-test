// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';
import { ExtensionContext } from 'vscode';


export async function runFromCodeLens(context: ExtensionContext, test: ITestItem, isDebug: boolean): Promise<void> {
    const runnerContext: IRunnerContext = {
        scope: test.level,
        testUri: test.location.uri,
        fullName: test.fullName,
        projectName: test.project,
        isDebug,
    };

    context.globalState.update("java.test.runner.last.call.context", runnerContext);
    context.globalState.update("java.test.runner.last.call.test", test);

    await runnerScheduler.run([test], runnerContext);
}
