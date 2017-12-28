// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestStatus, TestSuite } from "./protocols";
import { TestResourceManager } from "./testResourceManager";

import * as os from 'os';
import * as path from 'path';
import * as pug from 'pug';
import { window, workspace, ExtensionContext, TextDocumentContentProvider, Uri, WorkspaceConfiguration } from "vscode";

export class TestReportProvider implements TextDocumentContentProvider {

    public static scheme = 'test-report';
    private static compiledClassTemplate: (any) => string;
    private static compiledErrorTemplate: (any) => string;
    private static compiledMethodTemplate: (any) => string;

    constructor(private _context: ExtensionContext, private _testResourceProvider: TestResourceManager) {
        TestReportProvider.compiledClassTemplate =
            pug.compileFile(this._context.asAbsolutePath(path.join('resources', 'templates', 'report_class.pug')));
        TestReportProvider.compiledErrorTemplate =
            pug.compileFile(this._context.asAbsolutePath(path.join('resources', 'templates', 'report_error.pug')));
        TestReportProvider.compiledMethodTemplate =
            pug.compileFile(this._context.asAbsolutePath(path.join('resources', 'templates', 'report_method.pug')));
    }

    public async provideTextDocumentContent(uri: Uri): Promise<string> {
        const [target, test, reportType] = decodeTestSuite(uri);
        const testsContainedInFile = this._testResourceProvider.getTests(target);
        if (!testsContainedInFile) {
            return this.errorSnippet(`No tests in the uri: ${uri}. Shouldn\'t happen, please report us a bug.`);
        }
        if (testsContainedInFile.dirty) {
            return this.errorSnippet('Test file has been changed, try open the report again...');
        }
        const testMap: Map<string, TestSuite> = new Map(testsContainedInFile.tests.map((t): [string, TestSuite] => [t.test, t]));
        const matchedTest = testMap.get(test);
        if (!matchedTest) {
            return this.errorSnippet('No matched test found in the test storage. Shouldn\'t happen, please report us a bug.');
        }
        return this.reportSnippet(matchedTest, reportType);
    }

    private reportSnippet(test: TestSuite, type: TestReportType): string | Promise<string> {
        switch (test.level) {
            case TestLevel.Class:
                return this.classSnippet(test, type);
            case TestLevel.Method:
                return this.methodSnippet(test);
            default:
                return this.errorSnippet('Not supported test level. Currently support class level and method level.');
        }
    }

    private classSnippet(test: TestSuite, type: TestReportType): Promise<string> {
        const passedTests: TestSuite[] = test.children.filter((c) => c.result && c.result.status === TestStatus.Pass);
        const failedTests: TestSuite[] = test.children.filter((c) => c.result && c.result.status === TestStatus.Fail);
        const skippedTests: TestSuite[] = test.children.filter((c) => c.result && c.result.status === TestStatus.Skipped);
        const extraInfo = {
            tests: type === TestReportType.All ? test.children : (type === TestReportType.Failed ? failedTests : passedTests),
            uri: encodeURI('command:vscode.previewHtml?' + JSON.stringify(encodeTestSuite(Uri.parse(test.uri), test, TestReportType.All))),
            passedUri: encodeURI('command:vscode.previewHtml?' + JSON.stringify(encodeTestSuite(Uri.parse(test.uri), test, TestReportType.Passed))),
            failedUri: encodeURI('command:vscode.previewHtml?' + JSON.stringify(encodeTestSuite(Uri.parse(test.uri), test, TestReportType.Failed))),
            type,
            cssFile: this.cssTheme(),
            totalCount: test.children.length,
            passCount: passedTests.length,
            failedCount: failedTests.length,
            skippedCount: skippedTests.length,
        };
        const copied = {...test, ...extraInfo};
        return this.renderSnippet(copied, TestReportProvider.compiledClassTemplate);
    }

    private methodSnippet(test: TestSuite): Promise<string> {
        const extraInfo = {
            cssFile: this.cssTheme(),
        };
        const copied = {...test, ...extraInfo};
        return this.renderSnippet(copied, TestReportProvider.compiledMethodTemplate);
    }

    private errorSnippet(error: string): Promise<string> {
        const info = {
            cssFile: this.cssTheme(),
            message: error,
        };
        return this.renderSnippet(info, TestReportProvider.compiledErrorTemplate);
    }

    private async renderSnippet(content: any, template: (any) => string): Promise<string> {
        return template(content);
    }

    private cssTheme(): string {
        const config: WorkspaceConfiguration = workspace.getConfiguration();
        const theme: string = config.get<string>("workbench.colorTheme", null);
        const reportTheme: string = theme && theme.toLowerCase().indexOf("light") !== -1 ? "light.css" : "dark.css";
        return this._context.asAbsolutePath(path.join('resources', 'templates', 'css', reportTheme));
    }
}

export function encodeTestSuite(uri: Uri, test: TestSuite, type: TestReportType = TestReportType.All): Uri {
    const query = JSON.stringify([uri.toString(), test.test.replace('#', '%23'), type]);
    return Uri.parse(`${TestReportProvider.scheme}:${parseTestReportName(test, type)}?${query}`);
}

export function decodeTestSuite(uri: Uri): [Uri, string, TestReportType] {
    const [target, test, type] = <[string, string, TestReportType]>JSON.parse(uri.query);
    return [Uri.parse(target), test.replace('%23', '#'), type];
}

export function parseTestReportName(test: TestSuite, type: TestReportType = TestReportType.All): string {
    const name: string = test.test.split(/\.|#/).slice(-1)[0];
    if (test.level === TestLevel.Method) {
        return name;
    }
    return `${name} - ${TestReportType[type]}`;
}

export enum TestReportType {
    All,
    Passed,
    Failed,
}
