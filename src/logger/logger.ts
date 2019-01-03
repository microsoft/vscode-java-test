// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { ConfigurationChangeEvent, Disposable, workspace } from 'vscode';
import * as winston from 'winston';
import { LOG_FILE_MAX_NUMBER, LOG_FILE_MAX_SIZE, LOG_FILE_NAME, LOG_LEVEL_SETTING_KEY } from '../constants/configs';
import { getLogLevel } from '../utils/settingUtils';
import { outputChannelTransport } from './outputChannelTransport';

class Logger implements Disposable {
    private logger: winston.Logger;

    public initialize(storagePath: string, disposables: Disposable[]): void {
        this.logger = winston.createLogger({
            transports: [
                new (winston.transports.File)({
                    level: getLogLevel(),
                    filename: path.join(storagePath, LOG_FILE_NAME),
                    maxsize: LOG_FILE_MAX_SIZE,
                    maxFiles: LOG_FILE_MAX_NUMBER,
                    tailable: true,
                }),
                outputChannelTransport,
            ],
        });
        workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            if (e.affectsConfiguration(LOG_LEVEL_SETTING_KEY)) {
                const logLevel: string = getLogLevel();
                for (const transport of this.logger.transports) {
                    transport.level = logLevel;
                }
            }
        }, null, disposables);
    }

    public dispose(): void {
        for (const transport of this.logger.transports) {
            if (transport.close) {
                transport.close();
            }
        }
    }

    public verbose(message: string): void {
        this.logger.verbose(message);
    }

    public info(message: string): void {
        this.logger.info(message);
    }

    public error(message: string, error?: Error): void {
        this.logger.error(`${message}.${error ? ' ' + error : ''}`);
    }
}

export const logger: Logger = new Logger();
