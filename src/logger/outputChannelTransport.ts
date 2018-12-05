// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { OutputChannel, window } from 'vscode';
import * as Transport from 'winston-transport';

class OutputChannelTransport extends Transport {
    private channel: OutputChannel;
    constructor(options: Transport.TransportStreamOptions) {
        super(options);
        this.channel = window.createOutputChannel('Java Test Runner');
    }

    public log(msg: any, next?: () => void): any {
        if (typeof msg === 'string' || msg instanceof String) {
            this.channel.append(msg as string);
        } else if (msg && msg.message) {
            this.channel.append(msg.message);
        }

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

export const outputChannelTransport: OutputChannelTransport = new OutputChannelTransport({level: 'info'});
