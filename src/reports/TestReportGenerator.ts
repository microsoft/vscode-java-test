// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import { TestItem, Uri, workspace, window } from 'vscode';

export interface TestResult {
    id: string;
    label: string;
    status: 'passed' | 'failed' | 'skipped' | 'errored';
    duration?: number;
    errorMessage?: string;
    location?: string;
}

export interface TestReport {
    timestamp: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    errored: number;
    duration: number;
    tests: TestResult[];
}

export class TestReportGenerator {
    private results: Map<string, TestResult> = new Map();
    private startTime: number = 0;

    constructor() {
        this.startTime = Date.now();
    }

    public recordStarted(item: TestItem): void {
        this.results.set(item.id, {
            id: item.id,
            label: this.cleanLabel(item.label),
            status: 'passed',
            location: item.uri?.fsPath,
        });
    }

    private cleanLabel(label: string): string {
        // Remove codicons (e.g., "$(symbol-method) testName" -> "testName")
        const match = label.match(/(?:\$\(.+?\)\s*)?(.*)/);
        return match?.[1] || label;
    }

    public recordPassed(item: TestItem, duration?: number): void {
        const result = this.results.get(item.id);
        if (result) {
            result.status = 'passed';
            result.duration = duration;
        }
    }

    public recordFailed(item: TestItem, duration?: number, errorMessage?: string): void {
        const result = this.results.get(item.id);
        if (result) {
            result.status = 'failed';
            result.duration = duration;
            result.errorMessage = errorMessage;
        }
    }

    public recordSkipped(item: TestItem): void {
        const result = this.results.get(item.id);
        if (result) {
            result.status = 'skipped';
        }
    }

    public recordErrored(item: TestItem, duration?: number, errorMessage?: string): void {
        const result = this.results.get(item.id);
        if (result) {
            result.status = 'errored';
            result.duration = duration;
            result.errorMessage = errorMessage;
        }
    }

    public async generateReport(): Promise<void> {
        const totalDuration = Date.now() - this.startTime;
        const tests = Array.from(this.results.values());
        
        const report: TestReport = {
            timestamp: new Date().toISOString(),
            totalTests: tests.length,
            passed: tests.filter(t => t.status === 'passed').length,
            failed: tests.filter(t => t.status === 'failed').length,
            skipped: tests.filter(t => t.status === 'skipped').length,
            errored: tests.filter(t => t.status === 'errored').length,
            duration: totalDuration,
            tests: tests,
        };

        await this.saveReport(report);
    }

    private async saveReport(report: TestReport): Promise<void> {
        try {
            const workspaceFolder = workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                window.showErrorMessage('No workspace folder found to save test report');
                return;
            }

            const reportsDir = path.join(workspaceFolder.uri.fsPath, 'test-reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(reportsDir, `test-report-${timestamp}.json`);
            
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

            const action = await window.showInformationMessage(
                `Test report generated: ${report.passed}/${report.totalTests} passed`,
                'Open Report'
            );

            if (action === 'Open Report') {
                const doc = await workspace.openTextDocument(Uri.file(reportPath));
                await window.showTextDocument(doc);
            }
        } catch (error) {
            window.showErrorMessage(`Failed to save test report: ${error}`);
        }
    }
}
