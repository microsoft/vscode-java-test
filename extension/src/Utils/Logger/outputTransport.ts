// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { OutputChannel } from 'vscode';
import * as winston from 'winston';

import * as Commands from '../../Constants/commands';
import * as Logger from './logger';
import { LogLevel } from './loglevel';

export class OutputTransport extends winston.Transport {
    private static commandList: Set<string> = new Set([
        Commands.JAVA_RUN_TEST_COMMAND,
        Commands.JAVA_DEBUG_TEST_COMMAND,
        Commands.JAVA_TEST_EXPLORER_RUN_TEST,
        Commands.JAVA_TEST_EXPLORER_DEBUG_TEST,
        Commands.JAVA_RUN_WITH_CONFIG_COMMAND,
        Commands.JAVA_DEBUG_WITH_CONFIG_COMMAND,
        Commands.JAVA_TEST_EXPLORER_RUN_TEST_WITH_CONFIG,
        Commands.JAVA_TEST_EXPLORER_DEBUG_TEST_WITH_CONFIG,
    ]);
    private name: string;
    private level: string;
    private channel: OutputChannel;
    constructor(options: any) {
        super(options);
        this.name = 'output';
        this.channel = options.channel;
        this.level = options.level || 'info';
    }

    protected log(level: string, msg: string, meta?: any, callback?: (arg1, arg2) => void) {
        const logLevel: LogLevel | undefined = LogLevel[level];
        if (logLevel === undefined || logLevel > LogLevel[this.level]) {
            return;
        }
        const command: string = Logger.currentCommand();
        if (!command || !OutputTransport.commandList.has(command)) {
            return;
        }
        this.channel.append(msg);
        super.emit('logged');
        if (callback) {
            callback(null, true);
        }
    }
}
