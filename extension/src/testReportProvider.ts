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
        const totalCount: number = test.children.length;
        const passCount: number = test.children.filter((c) => c.result && c.result.status === TestStatus.Pass).length;
        const failCount: number = test.children.filter((c) => c.result && c.result.status === TestStatus.Fail).length;
        const skipCount: number = test.children.filter((c) => c.result && c.result.status === TestStatus.Skipped).length;
        const allTestsSnippet: string = test.children.map((c) => this.methodSnippetInTable(c)).join(' ');
        const passedTestsSnippet: string = test.children.filter((c) => c.result && c.result.status === TestStatus.Pass)
                                                        .map((c) => this.methodSnippetInTable(c)).join(' ');
        const failedTestsSnippet: string = test.children.filter((c) => c.result && c.result.status === TestStatus.Fail)
                                                        .map((c) => this.methodSnippetInTable(c)).join(' ');
        const tableHeaderString: string = `
            <tr>
                <th>Method</th>
                <th>Status</th>
                <th>Duration(ms)</th>
                <th>Message</th>
                <th>StackTrace</th>
            </tr>`;
        return `
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src *; style-src 'nonce-self'; script-src 'nonce-check';">
                <style nonce="self">
                    .run {
                        width:33%;
                        float:left;
                    }
                    .failed {
                        width:33%;
                        float:left;
                    }
                    .passed {
                        width:33%;
                        float:left;
                    }
                    #status div span {
                        display: table-cell;
                    }
                    #status div .counter {
                        background-color:rgb(200,200,200);
                        color:black;
                        width:100%;
                    }
                    #color-status {
                        background-color: ${failCount > 0 ? "red" : (passCount + skipCount === totalCount ? "green" : "orange")};
                        height: 15px;
                        float:left;
                        width:100%;
                    }
                </style>
            </head>
            <body>
                <div>Test report of class: ${test.test}</div>
                <hr/>
                <div id="status">
                    <div class="run">
                        <span class="label">Run:</span><span class="counter">${passCount + failCount + skipCount}/${totalCount}</span>
                    </div>
                    <div class="passed"><span class="label">Passed:</span><span class="counter">${passCount}</span></div>
                    <div class="failed"><span class="label">Failed:</span><span class="counter">${failCount}</span></div>
                </div>
                <div id="color-status">
                    &nbsp;
                </div>
                <div id="summary">
                    <span>${test.result && test.result.summary ? "Summary: " + test.result.summary : ""}</span>
                </div>
                <div id="filter">
                    <label><input type="radio" name="test" value="all" checked ="checked"> All tests</label>
                    <label><input type="radio" name="test" value="passed"> Passed</label>
                    <label><input type="radio" name="test" value="failed"> Failed</label>
                </div>
                <div id="children">
                    <table border="1">
                        ${tableHeaderString}
                        ${allTestsSnippet}
                    </table>
                </div>
                <script nonce="check">
                    document.addEventListener('DOMContentLoaded', () => {
                        const elements = [...document.getElementsByTagName("input")];
                        elements.forEach((element) => element.addEventListener('change', check));
                    });
                    function check(event) {
                        const radio = event.target;
                        const v = radio.value;
                        const table = document.getElementById("children").getElementsByTagName("table")[0];
                        if (v === 'all') {
                            table.innerHTML = ${'`' + tableHeaderString + allTestsSnippet + '`'};
                        } else if (v === 'passed') {
                            table.innerHTML = ${'`' + tableHeaderString + passedTestsSnippet + '`'};
                        } else if (v === 'failed') {
                            table.innerHTML = ${'`' + tableHeaderString + failedTestsSnippet + '`'};
                        }
                    }
                </script>
            </body>`;
    }

    private methodSnippetInTable(test: TestSuite): string {
        let content: string = `<tr><td>${test.test.replace('#', '.')}</td>`;
        content += `<td>${test.result ? test.result.status : "Not run"}</td>`;
        content += `<td>${test.result && test.result.duration ? test.result.duration : "N/A"}</td>`;
        content += `<td>${test.result && test.result.message ?  test.result.message : "N/A"}</td>`;
        content += `<td>${test.result && test.result.details ? "<pre><code>" + test.result.details + "</code></pre>" : "N/A"}</td></tr>`;
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
                    <span>${test.result && test.result.duration ? "Duration: " + test.result.duration + " milliseconds" : "N/A"}</span>
                </div>
                <div id="message">
                    <span>${test.result && test.result.message ? "Message: " + test.result.message : "N/A"}</span>
                </div>
                <div id="callstack">
                    <div>${test.result && test.result.details ? "CallStack: <pre><code>" + test.result.details + "</code></pre>" : "N/A"}</div>
                </div>
            </body>`;
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
