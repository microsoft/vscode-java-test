// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration } from 'vscode';
import { IProgressReporter } from '../debugger.api';
import { IRunnerContext } from './models';

export interface ITestRunner {
    setup(context: IRunnerContext): Promise<void>;
    run(launchConfiguration: DebugConfiguration, progressReporter?: IProgressReporter): Promise<Set<string>>;
    tearDown(isCancel: boolean): Promise<void>;
}
