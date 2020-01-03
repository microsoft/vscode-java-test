// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration } from 'vscode';
import { ITestItem } from '../protocols';

export interface ITestRunner {
    setup(tests: ITestItem[]): Promise<void>;
    run(launchConfiguration: DebugConfiguration): Promise<Set<string>>;
    tearDown(isCancel: boolean): Promise<void>;
}
