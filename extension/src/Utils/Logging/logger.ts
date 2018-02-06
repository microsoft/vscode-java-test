// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { OutputChannel } from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import * as Constants from "../../constants";
import { LogLevel } from './logListener';

export class Logger {
    private _telemetryReporter: TelemetryReporter;
    private _telemetryReportThreshold: LogLevel = LogLevel.Error;
    constructor(private _channel: OutputChannel) {
    }

    public setTelemetryReporter(reporter: TelemetryReporter, reportLevel: LogLevel) {
        this._telemetryReporter = reporter;
        this._telemetryReportThreshold = reportLevel;
    }

    public logError(errorMessage: string, stack: string = null, transactionId: string = null): void {
        this._channel.append(errorMessage);
        if (this._telemetryReporter && this._telemetryReportThreshold >= LogLevel.Error) {
            this._telemetryReporter.sendTelemetryEvent(Constants.TELEMETRY_EXCEPTION_SCOPE, {
                error: errorMessage,
                stack,
                transactionId, // TO-DO: refactor logger to separate log listeners and let telemetry listener to handle transactionid thing
            });
        }
    }

    public logInfo(message: string, transactionId: string = null): void {
        this._channel.append(message);
        if (this._telemetryReporter && this._telemetryReportThreshold >= LogLevel.Info) {
            this._telemetryReporter.sendTelemetryEvent(Constants.TELEMETRY_INFO_SCOPE, {
                info: message,
                transactionId,
            });
        }
    }

    public dispose() {
        if (this._telemetryReporter) {
            this._telemetryReporter.dispose();
        }
        this._channel.dispose();
    }
}
