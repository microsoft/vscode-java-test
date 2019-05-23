// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as _ from 'lodash';
import { Uri, ViewColumn, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { DEFAULT_LOG_LEVEL, DEFAULT_REPORT_POSITION, DEFAULT_REPORT_SHOW, LOG_LEVEL_SETTING_KEY, REPORT_POSITION_SETTING_KEY, REPORT_SHOW_SETTING_KEY } from '../constants/configs';
import { logger } from '../logger/logger';
import { IExecutionConfig } from '../runConfigs';

export function getReportPosition(): ViewColumn {
    const config: WorkspaceConfiguration = workspace.getConfiguration();
    const position: string = config.get<string>(REPORT_POSITION_SETTING_KEY, DEFAULT_REPORT_POSITION);
    return position === DEFAULT_REPORT_POSITION ? ViewColumn.Two : ViewColumn.Active;
}

export function getLogLevel(): string {
    return workspace.getConfiguration().get<string>(LOG_LEVEL_SETTING_KEY, DEFAULT_LOG_LEVEL);
}

export function getShowReportSetting(): string {
    return workspace.getConfiguration().get<string>(REPORT_SHOW_SETTING_KEY, DEFAULT_REPORT_SHOW);
}

const workspaceRegexp: RegExp = /\$\{workspacefolder\}/i;
export function resolve(config: IExecutionConfig, uri: Uri): IExecutionConfig {
    const resolvedConfig: IExecutionConfig = {};
    const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        logger.error(`Failed to parse the working directory for test: ${uri}`);
        return config;
    }

    if (config.workingDirectory) {
        if (workspaceRegexp.test(config.workingDirectory)) {
            resolvedConfig.workingDirectory = config.workingDirectory.replace(workspaceRegexp, workspaceFolder.uri.fsPath);
        } else {
            resolvedConfig.workingDirectory = config.workingDirectory;
        }
    }

    if (config.args) {
        resolvedConfig.args = [];
        for (const arg of config.args) {
            if (needResolve(arg)) {
                resolvedConfig.args.push(arg.replace(workspaceRegexp, workspaceFolder.uri.fsPath));
            } else {
                resolvedConfig.args.push(arg);
            }
        }
    }

    if (config.vmargs) {
        resolvedConfig.vmargs = [];
        for (const vmarg of config.vmargs as string[]) {
            if (needResolve(vmarg)) {
                resolvedConfig.vmargs.push(vmarg.replace(workspaceRegexp, workspaceFolder.uri.fsPath));
            } else {
                resolvedConfig.vmargs.push(vmarg);
            }
        }
    }

    if (config.env) {
        resolvedConfig.env = {};
        for (const key of Object.keys(config.env)) {
            if (needResolve(config.env[key])) {
                resolvedConfig.env[key] = config.env[key].replace(workspaceRegexp, workspaceFolder.uri.fsPath);
            } else {
                resolvedConfig.env[key] = config.env[key];
            }
        }
    }

    return resolvedConfig;
}

function needResolve(value: any): boolean {
    return _.isString(value) && workspaceRegexp.test(value);
}
