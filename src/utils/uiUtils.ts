// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { window } from 'vscode';
import { showOutputChannel } from '../commands/logCommands';
import { OPEN_OUTPUT_CHANNEL } from '../constants/dialogOptions';
import { testStatusBarProvider } from '../testStatusBarProvider';

export function showError(error: Error): void {
    window.showErrorMessage(`${error}`, OPEN_OUTPUT_CHANNEL).then((choice: string | undefined) => {
        if (choice === OPEN_OUTPUT_CHANNEL) {
            showOutputChannel();
        }
    });
    testStatusBarProvider.showFailure();
}
