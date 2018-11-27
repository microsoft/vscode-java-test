// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as pug from 'pug';
import { Disposable, Event, EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { ITestItemBase } from './protocols';
import { ITestResult, ITestResultDetails, TestStatus } from './runners/models';
import { testResultManager } from './testResultManager';
import { decodeTestReportUri } from './utils/testReportUtils';

class TestReportProvider implements TextDocumentContentProvider, Disposable {
    private onDidChangeReportEmitter: EventEmitter<Uri> = new EventEmitter<Uri>();
    private reports: Set<Uri> = new Set<Uri>();
    private compiledReportTemplate: pug.compileTemplate;
    private context: ExtensionContext;

    public initialize(context: ExtensionContext): void {
        this.context = context;
        this.compiledReportTemplate = pug.compileFile(this.context.asAbsolutePath(path.join('resources', 'templates', 'report.pug')));
    }

    get onDidChange(): Event<Uri> {
        return this.onDidChangeReportEmitter.event;
    }

    public refresh(): void {
        for (const uri of this.reports) {
            this.onDidChangeReportEmitter.fire(uri);
        }
    }

    public async provideTextDocumentContent(uri: Uri): Promise<string> {
        const [uriArray, fullNameArray] = decodeTestReportUri(uri);
        const resultsToRender: ITestResult[] = [];
        for (let i: number = 0; i < uriArray.length; i++) {
            const result: ITestResultDetails | undefined = testResultManager.getResult(Uri.parse(uriArray[i]).fsPath, fullNameArray[i]);
            if (result) {
                resultsToRender.push({uri: uriArray[i].toString(), fullName: fullNameArray[i], result});
            }
        }
        return this.report(resultsToRender);
    }

    public addReport(uri: Uri): void {
        this.reports.add(uri);
    }

    public deleteReport(uri: Uri): void {
        this.reports.delete(uri);
    }

    public dispose(): void {
        this.reports.clear();
    }

    public get scheme(): string {
        return 'test-report';
    }

    public get testReportName(): string {
        return 'Java Test Report';
    }

    private report(results: ITestResult[]): string {
        const passedTests: ITestItemBase[] = results.filter((result: ITestResult) => result.result && result.result.status === TestStatus.Pass);
        const failedTests: ITestItemBase[] = results.filter((result: ITestResult) => result.result && result.result.status === TestStatus.Fail);
        const skippedTests: ITestItemBase[] = results.filter((result: ITestResult) => result.result && result.result.status === TestStatus.Skip);
        return this.render({
            tests: results,
            passedTests,
            failedTests,
            cssFile: this.cssTheme(),
            skippedCount: skippedTests.length,
        }, this.compiledReportTemplate);
    }

    private render(data: {}, template: pug.compileTemplate): string {
        return template(data);
    }

    private cssTheme(): string {
        const config: WorkspaceConfiguration = workspace.getConfiguration();
        const theme: string | undefined = config.get<string>('workbench.colorTheme');
        const reportTheme: string = theme && theme.toLowerCase().indexOf('light') !== -1 ? 'light.css' : 'dark.css';
        return this.context.asAbsolutePath(path.join('resources', 'templates', 'css', reportTheme));
    }
}

export const testReportProvider: TestReportProvider = new TestReportProvider();
