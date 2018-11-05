// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestItem } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { ITestResult } from './models';

export interface ITestRunner {
    setup(tests: ITestItem[], isDebug: boolean, config?: IExecutionConfig): Promise<void>;
    run(): Promise<ITestResult[]>;
    cleanUp(isCancel: boolean): Promise<void>;
}
