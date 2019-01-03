// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ViewColumn, workspace, WorkspaceConfiguration } from 'vscode';
import { DEFAULT_REPORT_POSITION, REPORT_POSITION_SETTING_KEY } from '../constants/configs';

export function getReportPosition(): ViewColumn {
    const config: WorkspaceConfiguration = workspace.getConfiguration();
    const position: string = config.get<string>(REPORT_POSITION_SETTING_KEY, DEFAULT_REPORT_POSITION);
    return position === DEFAULT_REPORT_POSITION ? ViewColumn.Two : ViewColumn.Active;
}

export enum TestReportType {
    All,
    Passed,
    Failed,
}
