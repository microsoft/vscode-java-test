// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ViewColumn, workspace, WorkspaceConfiguration } from 'vscode';

export function getReportPosition(): ViewColumn {
    const config: WorkspaceConfiguration = workspace.getConfiguration();
    const position: string = config.get<string>('java.test.report.position', 'sideView');
    return position === 'sideView' ? ViewColumn.Two : ViewColumn.Active;
}

export enum TestReportType {
    All,
    Passed,
    Failed,
}
