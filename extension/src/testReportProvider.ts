import { TestLevel, TestSuite } from "./protocols";
import { TestResourceManager } from "./testResourceManager";

import * as os from 'os';
import { TextDocumentContentProvider, Uri } from "vscode";

export class TestReportProvider implements TextDocumentContentProvider {

    static scheme = 'test-report';

    constructor(private _testResourceProvider: TestResourceManager) {
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
}

export function encodeTestSuite(uri: Uri, test: TestSuite): Uri {
    const query = JSON.stringify([uri.toString(), test.test.replace('#', '%23')]);
    return Uri.parse(`${TestReportProvider.scheme}:test-report?${query}`);
}

export function decodeTestSuite(uri: Uri): [Uri, string] {
    const [target, test] = <[string, string]>JSON.parse(uri.query);
    return [Uri.parse(target), test.replace('%23', '#')];
}