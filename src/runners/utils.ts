// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, TestItem, TestMessage, TestRun, Uri } from 'vscode';
import { JavaTestRunnerCommands } from '../constants';
import { asRange } from '../controller/utils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

export async function findTestLocation(fullName: string): Promise<Location | undefined> {
    const location: any | undefined = await executeJavaLanguageServerCommand<any>(
        JavaTestRunnerCommands.FIND_TEST_LOCATION, fullName);
    if (location) {
        return new Location(Uri.parse(location.uri), asRange(location.range)!);
    }

    return undefined;
}

export function setTestState(testRun: TestRun, item: TestItem, result: TestResultState, message?: TestMessage | TestMessage[], duration?: number): void {
    switch (result) {
        case TestResultState.Errored:
            testRun.errored(item, message || [], duration);
            break;
        case TestResultState.Failed:
            testRun.failed(item, message || [], duration);
            break;
        case TestResultState.Passed:
            testRun.passed(item, duration);
            break;
        case TestResultState.Skipped:
            testRun.skipped(item);
            break;
        case TestResultState.Running:
            testRun.started(item);
        default:
            break;
    }
}

// Copied from the proposed part of the API
export enum TestResultState {
    // Test will be run, but is not currently running.
    Queued = 1,
    // Test is currently running
    Running = 2,
    // Test run has passed
    Passed = 3,
    // Test run has failed (on an assertion)
    Failed = 4,
    // Test run has been skipped
    Skipped = 5,
    // Test run failed for some other reason (compilation error, timeout, etc)
    Errored = 6,
}
