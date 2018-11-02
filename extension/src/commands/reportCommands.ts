// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Uri, ViewColumn, workspace, WorkspaceConfiguration } from 'vscode';
import { ITestItemBase } from '../protocols';
import { testReportProvider } from '../testReportProvider';
import { encodeTestReportUri } from '../utils/testReportUtils';

export async function showReport(tests: ITestItemBase[]): Promise<void> {
    const uri: Uri = encodeTestReportUri(tests);
    const config: WorkspaceConfiguration = workspace.getConfiguration();
    const position: string = config.get<string>('java.test.report.position', 'sideView');
    await commands.executeCommand('vscode.previewHtml', uri, position === 'sideView' ? ViewColumn.Two : ViewColumn.Active, testReportProvider.testReportName);
}
