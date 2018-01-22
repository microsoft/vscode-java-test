// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export interface ITestRunnerContext {
    storagePath: string;
    port: number | undefined;
    transactionId: string | undefined; // TODO: remove later after refactoring logger
    extra: Map<string, ContextData>;
}

export class JarFileTestRunnerContext implements ITestRunnerContext {

    public readonly extra: Map<string, ContextData> = new Map<string, ContextData>();

    public storagePath: string;

    public port: number | undefined;

    public transactionId: string | undefined;

    public classpathStr: string;
}

export type ContextData = object | string | number | boolean;
