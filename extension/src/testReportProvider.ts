// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestStatus, TestSuite } from "./protocols";
import { TestResourceManager } from "./testResourceManager";

import * as os from 'os';
import * as path from 'path';
import { window, ExtensionContext, TextDocumentContentProvider, Uri } from "vscode";

export class TestReportProvider implements TextDocumentContentProvider {

    public static scheme = 'test-report';

    constructor(private _context: ExtensionContext, private _testResourceProvider: TestResourceManager) {
    }

    public provideTextDocumentContent(uri: Uri): string {
        const [target, test] = decodeTestSuite(uri);
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
        return this.reportSnippet(matchedTest);
    }

    private errorSnippet(error: string): string {
        return `
            <body>
                ${error}
            </body>`;
    }

    private reportSnippet(test: TestSuite): string {
        switch (test.level) {
            case TestLevel.Class:
                return this.classSnippet(test);
            case TestLevel.Method:
                return this.methodSnippet(test);
            default:
                return this.errorSnippet('Not supported test level. Currently support class level and method level.');
        }
    }

    private classSnippet(test: TestSuite): string {
        const passCount: number = test.children.filter((c) => c.result && c.result.status === TestStatus.Pass).length
                                  * 100.0 / test.children.length;
        const failCount: number = test.children.filter((c) => c.result && c.result.status === TestStatus.Fail).length
                                  * 100.0 / test.children.length;
        const skipCount: number = test.children.filter((c) => c.result && c.result.status === TestStatus.Skipped).length
                                  * 100.0 / test.children.length;
        return `
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src *; style-src 'self'; script-src 'nonce-chart';">
            </head>
            <body>
                <div>Test report of class: ${test.test}</div>
                <hr/>
                <div id="status style='width:80%'">
                    ${test.result ? '<canvas id="chart-area"/>' : '<span>Status: Not run</span>'}
                </div>
                <div id="summary">
                    <span>${test.result && test.result.summary ? "Summary: " + test.result.summary : ""}</span>
                </div>
                <div id="children">
                    <table border="1">
                        <tr>
                            <th>Method</th>
                            <th>Status</th>
                            <th>Duration(ms)</th>
                            <th>Message</th>
                            <th>StackTrace</th>
                        </tr>
                        ${test.children.map((c) => this.methodSnippetInTable(c)).join(' ')}
                    </table>
                </div>
                <script nonce="chart" src="${this.getResourcePath('Chart.js')}"></script>
                <script nonce="chart">
                    const config = {
                        type: 'pie',
                        data: {
                            datasets: [{
                                data: [${passCount}, ${failCount}, ${skipCount}],
                                backgroundColor: ['rgb(0, 255, 0)', 'rgb(255, 0, 0)', 'rgb(255, 140, 0)'],
                                label: 'Tests status percentage'
                            }],
                            labels: ["Pass", "Fail", "Skip"]
                        },
                        options: {responsive: true}
                    };
                    window.onload = function() {
                        const ctx = document.getElementById("chart-area").getContext("2d");
                        window.myPie = new Chart(ctx, config);
                    };
                </script>
            </body>`;
    }

    private methodSnippetInTable(test: TestSuite): string {
        let content: string = `<tr><td>${test.test.replace('#', '.')}</td>`;
        content += `<td>${test.result ? test.result.status : "Not run"}</td>`;
        content += `<td>${test.result && test.result.duration ? test.result.duration : ""}</td>`;
        content += `<td>${test.result && test.result.message ?  test.result.message : ""}</td>`;
        content += `<td>${test.result && test.result.details ? test.result.details : "N/A"}</td></tr>`;
        return content;
    }

    private methodSnippet(test: TestSuite): string {
        return `
            <body>
                <div>Test report of method: ${test.test.replace('#', '.')}</div>
                <hr/>
                <div id="status">
                    <span>Status:    ${test.result ? test.result.status : "Not run"}</span>
                </div>
                <div id="duration">
                    <span>${test.result && test.result.duration ? "Duration: " + test.result.duration + " milliseconds" : ""}</span>
                </div>
                <div id="message">
                    <span>${test.result && test.result.message ? "Message: " + test.result.message : ""}</span>
                </div>
                <div id="callstack">
                    <div>${test.result && test.result.details ? "CallStack: " + test.result.details : ""}</div>
                </div>
            </body>`;
    }

    private getResourcePath(file: string): string {
        return this._context.asAbsolutePath(path.join("resource", file));
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
