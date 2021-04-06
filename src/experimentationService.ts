// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ExtensionContext } from 'vscode';
import { addContextProperty, sendInfo } from 'vscode-extension-telemetry-wrapper';
import { getExperimentationServiceAsync, IExperimentationService, IExperimentationTelemetry, TargetPopulation } from 'vscode-tas-client';

class ExperimentationTelemetry implements IExperimentationTelemetry {

    public setSharedProperty(name: string, value: string): void {
        addContextProperty(name, value);
    }

    public postEvent(eventName: string, props: Map<string, string>): void {
        const payload: any = { __event_name__: eventName };
        for (const [key, value] of props) {
            payload[key] = value;
        }

        sendInfo('', payload);
    }
}

let expService: IExperimentationService;

export function getExpService(): IExperimentationService {
    return expService;
}

export async function initExpService(context: ExtensionContext): Promise<void> {
    const packageJson: {[key: string]: any} = require('../package.json');
    const extensionName: string = `${packageJson['publisher']}.${packageJson['name']}`;
    const extensionVersion: string = packageJson['version'];
    expService = await getExperimentationServiceAsync(extensionName, extensionVersion,
        TargetPopulation.Public, new ExperimentationTelemetry(), context.globalState);
}
