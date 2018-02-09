// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TelemetryWrapper } from 'vscode-extension-telemetry-wrapper';
import * as winston from "winston";

import * as Constants from '../../Constants/constants';
import * as Logger from './logger';
import { LogLevel } from './loglevel';

export class TelemetryTransport extends winston.Transport {
    private name: string;
    private level: string;
    constructor(options: any) {
        super(options);
        this.name = 'telemetry';
        this.level = options.level || 'warn';
    }

    protected log(level: string, msg: string, meta?: any, callback?: (arg1, arg2) => void) {
        const logLevel: LogLevel | undefined = LogLevel[level];
        if (logLevel === undefined || logLevel > LogLevel[this.level]) {
            return;
        }

        try {
            TelemetryWrapper.sendTelemetryEvent(this.toTelemetryEvent(logLevel), {
                message: msg,
                meta,
            });
        } catch (telemetryErr) {
            Logger.error("Failed to send telemetry event. error: " + telemetryErr);
        }
        super.emit("logged");
        if (callback) {
            callback(null, true);
        }
    }

    private toTelemetryEvent(level: LogLevel): string {
        switch (level) {
            case LogLevel.error:
                return Constants.TELEMETRY_EXCEPTION_SCOPE;
            case LogLevel.warn:
                return Constants.TELEMETRY_WARN_SCOPE;
            case LogLevel.info:
                return Constants.TELEMETRY_INFO_SCOPE;
        }
    }
}
