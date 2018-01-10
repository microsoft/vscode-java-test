// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export interface ILogListener {
    threshold: LogLevel;
    logError(message: string, stack: string, requestId: string): void;
    logWarning(message: string, requestId: string): void;
    logInfo(message: string, requestId: string): void;
}

export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
}
