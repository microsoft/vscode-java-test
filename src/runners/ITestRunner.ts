// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, DebugConfiguration } from 'vscode';
import { IProgressReporter } from '../debugger.api';
import { IRunTestContext } from '../java-test-runner.api';
import { TestReportGenerator } from '../reports/TestReportGenerator';

export interface ITestRunnerInternal {
    setup(context: IRunTestContext): Promise<void>;
    run(launchConfiguration: DebugConfiguration, token: CancellationToken, progressReporter?: IProgressReporter): Promise<void>;
    tearDown(isCancel: boolean): Promise<void>;
    setReportGenerator(reportGenerator: TestReportGenerator): void;
}
