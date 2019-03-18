// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as pug from 'pug';
import { Disposable, ExtensionContext, QuickPickItem, Range, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { openTextDocument } from './commands/explorerCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { logger } from './logger/logger';
import { ILocation } from './protocols';
import { ITestResult, TestStatus } from './runners/models';
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

    public async report(tests: ITestResult[]): Promise<void> {
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

        this.panel.webview.html = await testReportProvider.provideHtmlContent(tests);

        this.panel.reveal(position);
    }

    public async update(tests: ITestResult[]): Promise<void> {
        if (this.panel) {
            this.panel.webview.html = await testReportProvider.provideHtmlContent(tests);
        }
    }

    public async provideHtmlContent(testResults: ITestResult[]): Promise<string> {
        const allResultsMap: Map<string, ITestResult[]> = new Map();
        const passedResultMap: Map<string, ITestResult[]> = new Map();
        const failedResultMap: Map<string, ITestResult[]> = new Map();
        let passedCount: number = 0;
        let failedCount: number = 0;
        let skippedCount: number = 0;
        for (const result of testResults) {
            if (result) {
                this.putMethodResultIntoMap(allResultsMap, result);
                switch (result.details.status) {
                    case TestStatus.Pass:
                        this.putMethodResultIntoMap(passedResultMap, result);
                        passedCount++;
                        break;
                    case TestStatus.Fail:
                        this.putMethodResultIntoMap(failedResultMap, result);
                        failedCount++;
                        break;
                    case TestStatus.Skip:
                        skippedCount++;
                        break;
                }
            }
        }

        return this.compiledReportTemplate({
            tests: allResultsMap,
            passedTests: passedResultMap,
            failedTests: failedResultMap,
            allCount: testResults.length,
            passedCount,
            failedCount,
            skippedCount,
            jqueryUri: Uri.file(path.join(this.resourceBasePath, 'js', 'jquery-3.3.1.slim.min.js')).with({ scheme: 'vscode-resource' }),
            popperUri: Uri.file(path.join(this.resourceBasePath, 'js', 'popper.min.js')).with({ scheme: 'vscode-resource' }),
            bootstrapUri: Uri.file(path.join(this.resourceBasePath, 'js', 'bootstrap.min.js')).with({ scheme: 'vscode-resource' }),
            fontawesomeUri: Uri.file(path.join(this.resourceBasePath, 'css', 'font-awesome.min.css')).with({ scheme: 'vscode-resource' }),
        });
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }

    private putMethodResultIntoMap(map: Map<string, ITestResult[]>, result: ITestResult): void {
        const classFullName: string = result.fullName.substr(0, result.fullName.indexOf('#'));
        const methods: ITestResult[] | undefined = map.get(classFullName);
        if (methods) {
            methods.push(result);
        } else {
            map.set(classFullName, [result]);
        }
    }
}

interface ILocationQuickPick extends QuickPickItem {
    location: ILocation;
}

export const testReportProvider: TestReportProvider = new TestReportProvider();
