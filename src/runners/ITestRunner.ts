// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, DebugConfiguration } from 'vscode';
import { IProgressReporter } from '../debugger.api';
import { IRunTestContext } from '../types';

export interface ITestRunner {
    setup(context: IRunTestContext): Promise<void>;
    run(launchConfiguration: DebugConfiguration, token: CancellationToken, progressReporter?: IProgressReporter): Promise<void>;
    tearDown(isCancel: boolean): Promise<void>;
}
