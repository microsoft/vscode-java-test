// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import { Uri, window, workspace } from 'vscode';

export async function openLatestTestReport(): Promise<void> {
    try {
        const workspaceFolder = workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            window.showErrorMessage('No workspace folder found');
            return;
        }

        const reportsDir = path.join(workspaceFolder.uri.fsPath, 'test-reports');
        if (!fs.existsSync(reportsDir)) {
            window.showInformationMessage('No test reports found. Run tests to generate a report.');
            return;
        }

        const files = fs.readdirSync(reportsDir)
            .filter(f => f.startsWith('test-report-') && f.endsWith('.json'))
            .map(f => ({
                name: f,
                path: path.join(reportsDir, f),
                time: fs.statSync(path.join(reportsDir, f)).mtime
            }))
            .sort((a, b) => b.time.getTime() - a.time.getTime());

        if (files.length === 0) {
            window.showInformationMessage('No test reports found. Run tests to generate a report.');
            return;
        }

        const latestReport = files[0];
        const doc = await workspace.openTextDocument(Uri.file(latestReport.path));
        await window.showTextDocument(doc);
    } catch (error) {
        window.showErrorMessage(`Failed to open test report: ${error}`);
    }
}

