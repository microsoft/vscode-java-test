// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';
import { ExtensionContext } from 'vscode';


export async function runFromReTryStatusBar(context: ExtensionContext, test: ITestItem): Promise<void> {
  const runnerContext: IRunnerContext = <IRunnerContext>context.globalState.get("java.test.runner.last.call.context");
  const testActual: ITestItem = <ITestItem>context.globalState.get("java.test.runner.last.call.test");

  await runnerScheduler.run([testActual], runnerContext);
}
