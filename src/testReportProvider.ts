// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as compareVersions from 'compare-versions';
import * as path from 'path';
import * as pug from 'pug';
import { commands, Disposable, ExtensionContext, Uri, ViewColumn, Webview, WebviewPanel, window } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ILocation, ITestItem } from './protocols';
import { ITestResult, TestStatus } from './runners/models';
import { IExecutionCache, runnerScheduler } from './runners/runnerScheduler';
import { testItemModel } from './testItemModel';
import { getReportPosition } from './utils/settingUtils';

class TestReportProvider implements Disposable {

    private compiledReportTemplate: pug.compileTemplate;
    private context: ExtensionContext;
    private panel: WebviewPanel | undefined;
    private resourceBasePath: string;
    private canResolveStackTrace: boolean;

    public initialize(context: ExtensionContext, extensionVersion: string): void {
        this.context = context;
        this.compiledReportTemplate = require('pug-loader!../resources/templates/report.pug');
        this.resourceBasePath = path.join(this.context.extensionPath, 'resources', 'templates');
        if (compareVersions(extensionVersion, '0.70.0') >= 0) {
            this.canResolveStackTrace = true;
        }
    }

    public async report(tests?: ITestResult[]): Promise<void> {
        const executionCache: IExecutionCache | undefined = runnerScheduler.getExecutionCache();
        if (!tests && executionCache && executionCache.results) {
            tests = executionCache.results;
        }
        if (!tests || tests.length === 0) {
            return;
        }

        const position: ViewColumn = getReportPosition();
        if (!this.panel) {
            this.panel = window.createWebviewPanel('testRunnerReport', 'Java Test Report', position, {
                localResourceRoots: [
                    Uri.file(this.resourceBasePath),
                ],
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true,
            });

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);

            this.panel.webview.onDidReceiveMessage(async (message: any) => {
                if (!message) {
                    return;
                }
                switch (message.command) {
                    case JavaTestRunnerCommands.OPEN_DOCUMENT:
                        commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_REPORT_OPEN_TEST_SOURCE_LOCATION, message.uri, message.range, message.fullName);
                        break;
                    case JavaTestRunnerCommands.RELAUNCH_TESTS:
                        commands.executeCommand(JavaTestRunnerCommands.RELAUNCH_TESTS);
                        break;
                    case JavaTestRunnerCommands.JAVA_TEST_REPORT_OPEN_STACKTRACE:
                        commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_REPORT_OPEN_STACKTRACE, message.trace, message.fullName);
                        break;
                    default:
                        return;
                }
            }, null, this.context.subscriptions);
        }

        this.panel.webview.html = await testReportProvider.provideHtmlContent(tests, this.panel.webview);
        this.panel.iconPath = {
            light: Uri.file(path.join(this.resourceBasePath, '..', 'logo.lowers.light.svg')),
            dark: Uri.file(path.join(this.resourceBasePath, '..', 'logo.lowers.dark.svg')),
        };

        this.panel.reveal(this.panel.viewColumn || position);
    }

    public async update(tests: ITestResult[]): Promise<void> {
        if (this.panel) {
            this.panel.webview.html = await testReportProvider.provideHtmlContent(tests, this.panel.webview);
        }
    }

    public async provideHtmlContent(testResults: ITestResult[], webview: Webview): Promise<string> {
        const allResultsMap: Map<string, ITestReportItem[]> = new Map();
        const passedResultMap: Map<string, ITestReportItem[]> = new Map();
        const failedResultMap: Map<string, ITestReportItem[]> = new Map();
        const skippedResultMap: Map<string, ITestReportItem[]> = new Map();
        let passedCount: number = 0;
        let failedCount: number = 0;
        let skippedCount: number = 0;
        for (const result of testResults) {
            if (result) {
                const testItem: ITestItem | undefined = testItemModel.getItemById(result.id);
                const reportItem: ITestReportItem = Object.assign({},
                    result,
                    {
                        fullName: result.id,
                        location: testItem ? testItem.location : undefined,
                        displayName: testItem ? testItem.displayName : result.id.slice(result.id.indexOf('#') + 1),
                    },
                );
                const classFullName: string = result.id.slice(result.id.indexOf('@') + 1, result.id.indexOf('#'));
                this.putMethodResultIntoMap(allResultsMap, reportItem, classFullName);
                switch (result.status) {
                    case TestStatus.Pass:
                        this.putMethodResultIntoMap(passedResultMap, reportItem, classFullName);
                        passedCount++;
                        break;
                    case TestStatus.Fail:
                        this.putMethodResultIntoMap(failedResultMap, reportItem, classFullName);
                        failedCount++;
                        break;
                    case TestStatus.Skip:
                        this.putMethodResultIntoMap(skippedResultMap, reportItem, classFullName);
                        skippedCount++;
                        break;
                }
            }
        }

        return this.compiledReportTemplate({
            tests: allResultsMap,
            passedTests: passedResultMap,
            failedTests: failedResultMap,
            skippedTests: skippedResultMap,
            allCount: testResults.length,
            passedCount,
            failedCount,
            skippedCount,
            resourceBaseUri: webview.asWebviewUri(Uri.file(path.join(this.resourceBasePath))),
            nonce: this.getNonce(),
            canResolveStackTrace: this.canResolveStackTrace,
        });
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }

    private putMethodResultIntoMap(map: Map<string, ITestReportItem[]>, reportItem: ITestReportItem, classFullName: string): void {
        const methods: ITestReportItem[] | undefined = map.get(classFullName);
        if (methods) {
            methods.push(reportItem);
        } else {
            map.set(classFullName, [reportItem]);
        }
    }

    private getNonce(): string {
        let text: string = '';
        const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i: number = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

interface ITestReportItem extends ITestResult {
    fullName: string;
    location: ILocation | undefined;
    displayName: string;
}

export const testReportProvider: TestReportProvider = new TestReportProvider();
