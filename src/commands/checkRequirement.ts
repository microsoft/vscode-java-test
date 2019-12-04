// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Uri, window, workspace } from 'vscode';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { VSCodeCommands } from '../constants/commands';
import { GETTING_STARTED_URL, HINT_FOR_UNSUPPORTED_USAGE_KEY } from '../constants/configs';
import { LEARN_MORE, NEVER_SHOW } from '../constants/dialogOptions';
import { logger } from '../logger/logger';
import * as commandUtils from '../utils/commandUtils';

export async function checkRequirement(): Promise<void> {
    const violations: IRequirementViolation[] = await commandUtils.checkRequirement();
    if (violations.length === 0) {
        return;
    }

    sendInfo('', { unsupportedUsage: 1 });
    logger.info('Following project(s) may not be able to run tests due to containing unsupported test usage:\n');
    for (const violation of violations) {
        logger.info(`\t- Project: ${violation.projectName}, Reason: ${violation.violation}\n`);
    }
    logger.info(`More details: ${GETTING_STARTED_URL}`);

    if (hintForUnsupportedUsage()) {
        const choice: string | undefined = await window.showInformationMessage('Detected the workspace contains unsupported test usage, please open the output channel for more details.', LEARN_MORE, NEVER_SHOW);
        if (choice === LEARN_MORE) {
            commands.executeCommand(VSCodeCommands.OPEN, Uri.parse(GETTING_STARTED_URL));
        } else if (choice === NEVER_SHOW) {
            updateHintForUnsupportedUsage(false);
        }
    }
}

function hintForUnsupportedUsage(): string {
    return workspace.getConfiguration().get<string>(HINT_FOR_UNSUPPORTED_USAGE_KEY, 'true');
}

function updateHintForUnsupportedUsage(enabled: boolean): void {
    workspace.getConfiguration().update(HINT_FOR_UNSUPPORTED_USAGE_KEY, enabled, true /* global setting */);
}

export interface IRequirementViolation {
    projectName: string;
    violation: string;
}
