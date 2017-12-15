// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestStatus, TestSuite } from "./protocols";
import { TestResourceManager } from "./testResourceManager";

import * as liquid from 'liquid-node';
import * as os from 'os';
import * as path from 'path';
import { window, ExtensionContext, TextDocumentContentProvider, Uri } from "vscode";

export class TestReportProvider implements TextDocumentContentProvider {

    public static scheme = 'test-report';
    private _engine: liquid.Engine;

    constructor(private _context: ExtensionContext, private _testResourceProvider: TestResourceManager) {
        this._engine = new liquid.Engine();
        this._engine.registerFileSystem(new liquid.LocalFileSystem(this._context.asAbsolutePath(path.join('resources', 'templates')), 'liquid'));
    }

    public provideTextDocumentContent(uri: Uri): string {
        const [target, test] = decodeTestSuite(uri);
        const testsContainedInFile = this._testResourceProvider.getTests(target);
        if (!testsContainedInFile) {
            return `No tests in the uri: ${uri}. Shouldn\'t happen, please report us a bug.`;
        }
        if (testsContainedInFile.dirty) {
            return 'Test file has been changed, try open the report again...';
        }
        const testMap: Map<string, TestSuite> = new Map(testsContainedInFile.tests.map((t): [string, TestSuite] => [t.test, t]));
        const matchedTest = testMap.get(test);
        if (!matchedTest) {
            return 'No matched test found in the test storage. Shouldn\'t happen, please report us a bug.';
        }
        return this.getTestReport(matchedTest);
    }

    // to-do: better formatting
    private getTestReport(test: TestSuite): string {
        let report = test.test + ':' + os.EOL;
        if (!test.result) {
            return report + "Not run...";
        }
        report += JSON.stringify(test.result, null, 4);
        if (test.level === TestLevel.Method) {
            return report;
        }
        report += os.EOL;
        for (const child of test.children) {
            report += this.getTestReport(child) + os.EOL;
        }
        return report;
    }

    private errorSnippet(error: string): string {
        return `
            <body>
                ${error}
            </body>`;
    }

    private reportSnippet(test: TestSuite): string | Promise<string> {
        switch (test.level) {
            case TestLevel.Class:
                return this.classSnippet(test);
            case TestLevel.Method:
                return this.methodSnippet(test);
            default:
                return this.errorSnippet('Not supported test level. Currently support class level and method level.');
        }
    }

    private classSnippet(test: TestSuite): Promise<string> {
        const passedTests: TestSuite[] = test.children.filter((c) => c.result && c.result.status === TestStatus.Pass);
        const failedTests: TestSuite[] = test.children.filter((c) => c.result && c.result.status === TestStatus.Fail);
        const skippedTests: TestSuite[] = test.children.filter((c) => c.result && c.result.status === TestStatus.Skipped);
        const extraInfo = {
            allTests: test.children,
            passedTests,
            failedTests,
            skippedTests,
            totalCount: test.children.length,
            passCount: passedTests.length,
            failedCount: failedTests.length,
            skippedCount: skippedTests.length,
        };
        const copied = {...test, ...extraInfo};
        return this.renderSnippet(copied, 'report_class');
    }

    private methodSnippet(test: TestSuite): Promise<string> {
        return this.renderSnippet(test, 'report_method');
    }

    private async renderSnippet(test: TestSuite, templateName: string): Promise<string> {
        return this._engine.fileSystem.readTemplateFile(templateName).then((template) => {
            return this._engine.parseAndRender(template, test);
        },
        (reason) => {
            return Promise.reject(reason);
        });
    }
}

export function encodeTestSuite(uri: Uri, test: TestSuite): Uri {
    const query = JSON.stringify([uri.toString(), test.test.replace('#', '%23')]);
    return Uri.parse(`${TestReportProvider.scheme}:test-report?${query}`);
}

export function decodeTestSuite(uri: Uri): [Uri, string] {
    const [target, test] = <[string, string]>JSON.parse(uri.query);
    return [Uri.parse(target), test.replace('%23', '#')];
}
