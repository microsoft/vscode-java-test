// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../protocols';
import { runnerScheduler } from '../runners/runnerScheduler';
import { IRunnerContext } from '../utils/launchUtils';

export async function runFromCodeLens(test: ITestItem, isDebug: boolean): Promise<void> {
    const runnerContext: IRunnerContext = {
        runFromRoot: false,
        testUri: test.location.uri,
        fullName: test.fullName,
        projectName: test.project,
        isDebug,
    };

    await runnerScheduler.run([test], runnerContext);
}
