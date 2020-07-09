// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as pug from 'pug';
import { Disposable, ExtensionContext, QuickPickItem, Range, Uri, ViewColumn, Webview, WebviewPanel, window } from 'vscode';
import { openTextDocument } from './commands/explorerCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { logger } from './logger/logger';
import { ILocation, ITestItem } from './protocols';
import { ITestResult, TestStatus } from './runners/models';
import { IExecutionCache, runnerScheduler } from './runners/runnerScheduler';
import { testItemModel } from './testItemModel';
import { searchTestLocation } from './utils/commandUtils';
import { getReportPosition } from './utils/settingUtils';

class TestReportProvider implements Disposable {

    private compiledReportTemplate: pug.compileTemplate;
    private context: ExtensionContext;
    private panel: WebviewPanel | undefined;
    private resourceBasePath: string;

    public initialize(context: ExtensionContext): void {
        this.context = context;
        this.compiledReportTemplate = require('pug-loader!../resources/templates/report.pug');
        this.resourceBasePath = path.join(this.context.extensionPath, 'resources', 'templates');
    }

    public async report(tests?: ITestResult[]): Promise<void> {
        const executionCache: IExecutionCache = runnerScheduler.getExecutionCache();
        if (executionCache.results) {
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
                        if (message.uri && message.range) {
                            return openTextDocument(Uri.parse(message.uri), JSON.parse(message.range) as Range);
                        } else if (message.fullName) {
                            const items: ILocation[] = await searchTestLocation(message.fullName);
                            if (items.length === 1) {
                                return openTextDocument(Uri.parse(items[0].uri), items[0].range);
                            } else if (items.length > 1) {
                                const pick: ILocationQuickPick | undefined = await window.showQuickPick(items.map((item: ILocation) => {
                                    return { label: message.fullName, detail: Uri.parse(item.uri).fsPath, location: item };
                                }), { placeHolder: 'Select the file you want to navigate to' });
                                if (pick) {
                                    return openTextDocument(Uri.parse(pick.location.uri), pick.location.range);
                                }
                            } else {
                                logger.error('No test item could be found from Language Server.');
                            }
                        } else {
                            logger.error('Could not open the document, Neither the Uri nor full name is null.');
                        }
                        break;
                    default:
                        return;
                }
            }, null, this.context.subscriptions);
        }

        this.panel.webview.html = await testReportProvider.provideHtmlContent(tests, this.panel.webview);
        this.panel.iconPath = Uri.file(path.join(this.resourceBasePath, '..', 'logo.lowers.png'));

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
                        fullName: result.id.slice(result.id.indexOf('@') + 1),
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

interface ILocationQuickPick extends QuickPickItem {
    location: ILocation;
}

interface ITestReportItem extends ITestResult {
    fullName: string;
    location: ILocation | undefined;
    displayName: string;
}

export const testReportProvider: TestReportProvider = new TestReportProvider();
