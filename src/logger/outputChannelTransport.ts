// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TransformableInfo } from 'logform';
import { OutputChannel, window } from 'vscode';
import * as Transport from 'winston-transport';
import { getLogLevel } from '../utils/settingUtils';

class OutputChannelTransport extends Transport {
    private channel: OutputChannel;
    constructor(options: Transport.TransportStreamOptions) {
        super(options);
        this.channel = window.createOutputChannel('Java Test Runner');
    }

    public log(msg: TransformableInfo, next?: () => void): any {
        this.channel.appendLine(msg.message);

        if (next) {
            next();
        }
    }

    public close(): void {
        this.channel.dispose();
    }

    public show(): void {
        this.channel.show();
    }
}

export const outputChannelTransport: OutputChannelTransport = new OutputChannelTransport({level: getLogLevel()});
