
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ExtensionContext } from 'vscode';

export function activate(context: ExtensionContext): void {
    // tslint:disable-next-line:no-console
    console.log(context);
}

export function deactivate(): void {
    // do nothing
}
