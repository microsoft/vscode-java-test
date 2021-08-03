// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export interface IRunnerResultAnalyzer {
    analyzeData(data: string): void;
    processData(data: string): void;
}
