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
        const testsContainedInFile = target.map((t) => this._testResourceProvider.getTests(t));
        if (testsContainedInFile.findIndex((t) => !t) !== -1) {
            return this.errorSnippet(`No tests in the uri: ${uri}. Shouldn\'t happen, please report us a bug.`);
        }
        if (testsContainedInFile.findIndex((t) => t.dirty) !== -1) {
            return this.errorSnippet('Test file has been changed, try open the report again...');
        }
        const testMap: Map<string, TestSuite> = new Map(
            testsContainedInFile.map((t) => t.tests).reduce((a, b) => a.concat(b)).map((t): [string, TestSuite] => [t.test, t]));
        const matchedTest = test.map((t) => testMap.get(t));
        if (matchedTest.findIndex((t) => !t) !== -1) {
            return this.errorSnippet('No matched test found in the test storage. Shouldn\'t happen, please report us a bug.');
        }
        return this.reportSnippet(matchedTest, reportType);
    }

    private reportSnippet(test: TestSuite[], type: TestReportType): Promise<string> {
        const flattenedTests: TestSuite[] = this.flattenTests(test);
        const passedTests: TestSuite[] = flattenedTests.filter((c) => c.result && c.result.status === TestStatus.Pass);
        const failedTests: TestSuite[] = flattenedTests.filter((c) => c.result && c.result.status === TestStatus.Fail);
        const skippedTests: TestSuite[] = flattenedTests.filter((c) => c.result && c.result.status === TestStatus.Skipped);
        const extraInfo = {
            tests: type === TestReportType.All ? flattenedTests : (type === TestReportType.Failed ? failedTests : passedTests),
            uri: 'command:vscode.previewHtml?' + encodeURIComponent(JSON.stringify(encodeTestSuite(test, TestReportType.All))),
            passedUri: 'command:vscode.previewHtml?' + encodeURIComponent(JSON.stringify(encodeTestSuite(test, TestReportType.Passed))),
            failedUri: 'command:vscode.previewHtml?' + encodeURIComponent(JSON.stringify(encodeTestSuite(test, TestReportType.Failed))),
            type,
            name: test.length === 1 ? test[0].test.replace("#", ".") : undefined,
            cssFile: this.cssTheme(),
            totalCount: flattenedTests.length,
            passCount: passedTests.length,
            failedCount: failedTests.length,
            skippedCount: skippedTests.length,
        };
        return this.renderSnippet(extraInfo, TestReportProvider.compiledClassTemplate);
    }

    private flattenTests(test: TestSuite[]): TestSuite[] {
        return test.map((t) => t.level === TestLevel.Class ? this.flattenTests(t.children) : [t]).reduce((a, b) => a.concat(b));
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

export function encodeTestSuite(test: TestSuite[], type: TestReportType = TestReportType.All): Uri {
    const query = JSON.stringify([test.map((t) => t.uri), test.map((t) => t.test), type]);
    return Uri.parse(`${TestReportProvider.scheme}:${parseTestReportName(test, type)}?${encodeURIComponent(query)}`);
}

export function decodeTestSuite(uri: Uri): [Uri[], string[], TestReportType] {
    const [target, test, type] = <[string[], string[], TestReportType]>JSON.parse(decodeURIComponent(uri.query));
    return [target.map((t) => Uri.parse(t)), test, type];
}

export function parseTestReportName(test: TestSuite[], type: TestReportType = TestReportType.All): string {
    if (test.length > 1) {
        return 'Aggregated test report';
    }
    const name: string = test[0].test.split(/\.|#/).slice(-1)[0];
    if (test[0].level === TestLevel.Method) {
        return name;
    }
    return `${name} - ${TestReportType[type]}`;
}

export enum TestReportType {
    All,
    Passed,
    Failed,
}
