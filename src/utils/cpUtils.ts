// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as kill from 'tree-kill';

export function killProcess(process: cp.ChildProcess): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
        if (process && !process.killed) {
            kill(process.pid, 'SIGTERM', () => {
                return resolve();
            });
        }
        resolve();
    });
}
