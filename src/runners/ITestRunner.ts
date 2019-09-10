// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { ITestItem } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { ITestResult } from './models';

export interface ITestRunner {
    setup(tests: ITestItem[], isDebug: boolean, config?: IExecutionConfig, node?: TestTreeNode): Promise<DebugConfiguration>;
    run(launchConfiguration: DebugConfiguration): Promise<ITestResult[]>;
    tearDown(isCancel: boolean): Promise<void>;
}
