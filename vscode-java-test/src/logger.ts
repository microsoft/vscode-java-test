import { OutputChannel } from "vscode";
import { Constants } from "./commands";
import TelemetryReporter from "vscode-extension-telemetry";

export class Logger {
    private _telemetryReporter: TelemetryReporter;
    private _telemetryReportThreshold: LogLevel = LogLevel.Error;
    constructor(private _channel: OutputChannel) {
    }

    public setTelemetryReporter(reporter: TelemetryReporter, reportLevel: LogLevel) {
        this._telemetryReporter = reporter;
        this._telemetryReportThreshold = reportLevel;
    }

    public logError(errorMessage: string, stack: string = null): void {
        this._channel.append(errorMessage);
        if (this._telemetryReporter && this._telemetryReportThreshold >= LogLevel.Error) {
            this._telemetryReporter.sendTelemetryEvent(Constants.TELEMETRY_EXCEPTION_SCOPE, {
                "error": errorMessage,
                "stack": stack,
            });
        }
    }

    public logInfo(message: string): void {
        this._channel.append(message);
        if (this._telemetryReporter && this._telemetryReportThreshold >= LogLevel.Info) {
            this._telemetryReporter.sendTelemetryEvent(Constants.TELEMETRY_INFO_SCOPE, {
                "info": message
            });
        }
    }

    public logUsage(props, measures): void {
        if (this._telemetryReporter) {
            this._telemetryReporter.sendTelemetryEvent(Constants.TELEMETRY_USAGEDATA_SCOPE, props, measures);
        }
    }

    public dispose() {
        if (this._telemetryReporter) {
            this._telemetryReporter.dispose();
        }
        this._channel.dispose();
    }
}

export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
}