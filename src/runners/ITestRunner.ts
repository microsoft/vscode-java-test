// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration } from 'vscode';
import { ISearchTestItemParams, ITestItem } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { ITestResult } from './models';

export interface ITestRunner {
    setup(tests: ITestItem[], isDebug: boolean, config?: IExecutionConfig, searchParam?: ISearchTestItemParams): Promise<DebugConfiguration>;
    run(launchConfiguration: DebugConfiguration): Promise<ITestResult[]>;
    cleanUp(isCancel: boolean): Promise<void>;
}
