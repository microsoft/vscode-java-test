// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as kill from 'tree-kill';

export function killProcess(process: cp.ChildProcess): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
        if (process) {
            kill(process.pid, 'SIGTERM', (error: Error | undefined) => {
                if (error) {
                    // TODO: Log
                }
                return resolve();
            });
        }
        resolve();
    });
}
