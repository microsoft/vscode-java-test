// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ExtensionContext } from 'vscode';
import { TelemetryWrapper } from 'vscode-extension-telemetry-wrapper';
import * as winston from 'winston';
import * as Configs from '../../Constants/configs';

export function configure(context: ExtensionContext, transports: winston.Transport[]) {
    winston.configure({
        transports: [
            ...transports,
            new (winston.transports.File)({level: 'info', filename: context.asAbsolutePath(Configs.LOG_FILE_NAME)}),
        ],
    });
}

export function info(message: string, metadata?: any, _userTag?: boolean) {
    winston.info(message, withUserTag(withSessionId(metadata)));
}

export function warn(message: string, metadata?: any, _userTag?: boolean) {
    winston.warn(message, withUserTag(withSessionId(metadata)));
}

export function error(message: string, metadata?: any, _userTag?: boolean) {
    winston.error(message, withUserTag(withSessionId(metadata)));
}

export function currentSessionId(): string | undefined {
    const session = TelemetryWrapper.currentSession();
    return session ? session.id : undefined;
}

export function currentCommand(): string | undefined {
    const session = TelemetryWrapper.currentSession();
    return session ? session.action : undefined;
}

function withSessionId(metadata?: any) {
    return {
        sessionId: currentSessionId(),
        ...metadata,
    };
}

function withUserTag(metadata?: any, tag?: boolean) {
    return {
        userTag: tag ? tag : false,
        ...metadata,
    };
}
