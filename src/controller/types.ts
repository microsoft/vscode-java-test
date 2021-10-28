// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, DebugConfiguration, Disposable, TestController, TestItem, TestRunRequest, TestTag } from 'vscode';
import { IProgressReporter } from '../debugger.api';

// tslint:disable-next-line: typedef
export const ITestController = Symbol('ITestController');
export interface ITestController extends Disposable {
    loadChildren: (item: TestItem, token?: CancellationToken) => Promise<void>;
    runTests: (request: TestRunRequest, option: IRunOption) => Promise<void>;
    refresh(): Promise<void>;
    getControllerImpl:() => TestController;
}

export interface IRunOption {
    isDebug: boolean;
    progressReporter?: IProgressReporter;
    onProgressCancelHandler?: Disposable;
    launchConfiguration?: DebugConfiguration;
    token?: CancellationToken;
}

export const runnableTag: TestTag = new TestTag('RunnableItem');