// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as pug from 'pug';
import { Disposable, ExtensionContext, Uri, WebviewPanel, window } from 'vscode';
import { ITestItemBase } from './protocols';
import { ITestResult, ITestResultDetails, TestStatus } from './runners/models';
import { testResultManager } from './testResultManager';
import { getReportPosition } from './utils/testReportUtils';

class TestReportProvider implements Disposable {

    private compiledReportTemplate: pug.compileTemplate;
    private context: ExtensionContext;
    private panel: WebviewPanel | undefined;

    public initialize(context: ExtensionContext): void {
        this.context = context;
        this.compiledReportTemplate = pug.compileFile(this.context.asAbsolutePath(path.join('resources', 'templates', 'report.pug')));
    }

    public async report(tests: ITestItemBase[]): Promise<void> {
        if (!this.panel) {
            this.panel = window.createWebviewPanel('testRunnerReport', 'Java Test Report', getReportPosition(), {
                localResourceRoots: [
                    Uri.file(path.join(this.context.extensionPath, 'resources', 'templates', 'css')),
                ],
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true,
            });

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);
        }

        this.panel.webview.html = await testReportProvider.provideHtmlContent(tests);
    }

    public async update(tests: ITestItemBase[]): Promise<void> {
        if (this.panel) {
            this.panel.webview.html = await testReportProvider.provideHtmlContent(tests);
        }
    }

    public async provideHtmlContent(tests: ITestItemBase[]): Promise<string> {
        const results: ITestResult[] = [];
        for (const test of tests) {
            const result: ITestResultDetails | undefined = testResultManager.getResult(Uri.parse(test.uri).fsPath, test.fullName);
            if (result) {
                results.push({uri: test.uri, fullName: test.fullName, result});
            }
        }

        const passedTests: ITestItemBase[] = results.filter((result: ITestResult) => result.result && result.result.status === TestStatus.Pass);
        const failedTests: ITestItemBase[] = results.filter((result: ITestResult) => result.result && result.result.status === TestStatus.Fail);
        const skippedTests: ITestItemBase[] = results.filter((result: ITestResult) => result.result && result.result.status === TestStatus.Skip);

        return this.compiledReportTemplate({
            tests: results,
            passedTests,
            failedTests,
            cssFile: this.cssFileUri,
            skippedCount: skippedTests.length,
        });
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }

    private get cssFileUri(): string {
        const cssFilePath: string = this.context.asAbsolutePath(path.join('resources', 'templates', 'css', 'report.css'));
        return Uri.file(cssFilePath).with({ scheme: 'vscode-resource' }).toString();
    }
}

export const testReportProvider: TestReportProvider = new TestReportProvider();
