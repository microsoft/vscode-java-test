// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Server } from 'net';
import { ISearchTestItemParams, ITestItem } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { ITestResult } from './models';

export interface ITestRunner {
    setup(tests: ITestItem[], isDebug: boolean, server: Server, config?: IExecutionConfig, searchParam?: ISearchTestItemParams): Promise<void>;
    run(): Promise<ITestResult[]>;
    cleanUp(isCancel: boolean): Promise<void>;
}
