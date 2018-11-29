// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export function isDarwin(): boolean {
    return process.platform === 'darwin';
}

export function isLinux(): boolean {
    return process.platform === 'linux';
}
