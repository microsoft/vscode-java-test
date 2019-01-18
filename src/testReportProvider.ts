// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as pug from 'pug';
import { Disposable, ExtensionContext, Range, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { openTextDocument } from './commands/explorerCommands';
import { JavaTestRunnerCommands } from './constants/commands';
import { logger } from './logger/logger';
import { ITestItemBase } from './protocols';
import { ITestResultDetails, TestStatus } from './runners/models';
import { testResultManager } from './testResultManager';
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

    public async report(tests: ITestItemBase[]): Promise<void> {
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
        }

        this.panel.webview.html = await testReportProvider.provideHtmlContent(tests);

        this.panel.webview.onDidReceiveMessage((message: any) => {
            if (!message) {
                return;
            }
            switch (message.command) {
                case JavaTestRunnerCommands.OPEN_DOCUMENT:
                    if (!message.uri) {
                        logger.error('Could not open the document, the Uri in the message is null.');
                        return;
                    }
                    return openTextDocument(Uri.parse(message.uri), JSON.parse(message.range) as Range);
                default:
                    return;
            }
        });

        this.panel.reveal(position);
    }

    public async update(tests: ITestItemBase[]): Promise<void> {
        if (this.panel) {
            this.panel.webview.html = await testReportProvider.provideHtmlContent(tests);
        }
    }

    public async provideHtmlContent(tests: ITestItemBase[]): Promise<string> {
        const allResultsMap: Map<string, IReportMethod[]> = new Map();
        const passedResultMap: Map<string, IReportMethod[]> = new Map();
        const failedResultMap: Map<string, IReportMethod[]> = new Map();
        let allCount: number = 0;
        let passedCount: number = 0;
        let failedCount: number = 0;
        let skippedCount: number = 0;
        for (const test of tests) {
            const result: ITestResultDetails | undefined = testResultManager.getResultDetails(Uri.parse(test.uri).fsPath, test.fullName);
            allCount++;
            if (result) {
                this.putMethodResultIntoMap(allResultsMap, test, result);
                switch (result.status) {
                    case TestStatus.Pass:
                        this.putMethodResultIntoMap(passedResultMap, test, result);
                        passedCount++;
                        break;
                    case TestStatus.Fail:
                        this.putMethodResultIntoMap(failedResultMap, test, result);
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
            allCount,
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

    private putMethodResultIntoMap(map: Map<string, IReportMethod[]>, test: ITestItemBase, result: ITestResultDetails): void {
        const classFullName: string = test.fullName.substr(0, test.fullName.indexOf('#'));
        const methods: IReportMethod[] | undefined = map.get(classFullName);
        if (methods) {
            methods.push({
                displayName: test.displayName,
                uri: test.uri,
                range: JSON.stringify(test.range),
                result,
            });
        } else {
            map.set(classFullName, [{
                displayName: test.displayName,
                uri: test.uri,
                range: JSON.stringify(test.range),
                result,
            }]);
        }
    }
}

interface IReportMethod {
    displayName: string;
    uri: string;
    range: string;
    result: ITestResultDetails;
}

export const testReportProvider: TestReportProvider = new TestReportProvider();
