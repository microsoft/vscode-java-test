// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestRunnerParameters } from '../testRunnerParameters';

export interface IJarFileTestRunnerParameters extends ITestRunnerParameters {
    classpathStr: string;
    runnerJarFilePath: string;
    runnerClassName: string;
}
