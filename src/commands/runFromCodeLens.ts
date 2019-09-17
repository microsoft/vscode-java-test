// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../protocols';
import { IRunnerContext } from '../runners/models';
import { runnerScheduler } from '../runners/runnerScheduler';

export async function runFromCodeLens(test: ITestItem, isDebug: boolean): Promise<void> {
    const runnerContext: IRunnerContext = {
        scope: test.level,
        testUri: test.location.uri,
        fullName: test.fullName,
        projectName: test.project,
        isDebug,
    };

    await runnerScheduler.run([test], runnerContext);
}
