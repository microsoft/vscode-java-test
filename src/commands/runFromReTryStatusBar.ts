// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ExtensionContext } from 'vscode';
import { ITestItem } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';

export async function runFromReTryStatusBar(context: ExtensionContext): Promise<void> {
    const runnerContext: IRunnerContext =  context.globalState.get('java.test.runner.last.call.context') as IRunnerContext;
    const testActual: ITestItem =  context.globalState.get('java.test.runner.last.call.test') as ITestItem;

    await runnerScheduler.run([testActual], runnerContext);
}
