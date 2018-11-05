// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cp from 'child_process';
import * as kill from 'tree-kill';
import { testOutputChannel } from '../testOutputChannel';

export function killProcess(process: cp.ChildProcess): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
        if (process) {
            kill(process.pid, 'SIGTERM', (error: Error | undefined) => {
                if (error) {
                    testOutputChannel.error('Failed to kill the process', error);
                }
                return resolve();
            });
        }
        resolve();
    });
}
