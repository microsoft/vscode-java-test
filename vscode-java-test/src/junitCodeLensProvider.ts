import { CodeLensProvider, Event, EventEmitter, TextDocument, CancellationToken, CodeLens, ProviderResult } from "vscode";
import { TestResourceManager } from './testResourceManager';
import { Commands } from './commands';
import { TestSuite, TestStatus, TestResult } from './protocols';

'use strict';

export class JUnitCodeLensProvider implements CodeLensProvider {
    constructor(private _onDidChange: EventEmitter<void>,
        private _testCollectionStorage: TestResourceManager) {
    }

    get onDidChangeCodeLenses(): Event<void> {
        return this._onDidChange.event;
    }

    public async provideCodeLenses(document: TextDocument, token: CancellationToken) {
        let testsFromCache = this._testCollectionStorage.getTests(document.uri);
        if (testsFromCache && !testsFromCache.dirty) {
            return getCodeLens(testsFromCache.tests);
        }
        return fetchTests(document).then((tests: TestSuite[]) => {
            this.transformIndex(tests);
            if (testsFromCache) {
                this.mergeTestResult(testsFromCache.tests, tests);
            }
            this._testCollectionStorage.storeTests(document.uri, tests);
            return getCodeLens(tests);
        },
        reason => {
            if (token.isCancellationRequested) {
                return [];
            }
            return Promise.reject(reason);
        });
    }

    private mergeTestResult(cache: TestSuite[], cur: TestSuite[]): void {
        const dict = new Map(cache.map((t): [string, TestResult | undefined] => [t.test, t.result]));
        cur.map((testSuite) => {
            if (!testSuite.result && dict.has(testSuite.test)) {
                testSuite.result = dict.get(testSuite.test);
            }
        });
    }

    private transformIndex(tests: TestSuite[]): void {
        tests.map((t) => {
            if (t.parentIndex) {
                t.parent = tests[t.parentIndex];
            }
            if (t.childrenIndices) {
                t.children = t.childrenIndices.map(i => tests[i]);
            }
        })
    }
}

function fetchTests(document: TextDocument) {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_FETCH_TEST, document.uri.toString());
}

function getTestStatusIcon(status?: TestStatus): string {
    switch (status) {
        case TestStatus.Pass: {
            return '✔ ';
        }
        case TestStatus.Fail: {
            return '✘ ';
        }
        case TestStatus.Skipped: {
            return '⃠ ';
        }
        default: {
            return '';
        }
    }
}

function getCodeLens(tests: TestSuite[]) : CodeLens[] {
    return tests.map(test => {
        return [
            new CodeLens(test.range, {
                title: getTestStatusIcon(test.result? test.result.status : undefined),
                command: Commands.JAVA_TEST_SHOW_DETAILS,
                arguments: [test]
            }),
            new CodeLens(test.range, {
                title: 'Run Test',
                command: Commands.JAVA_RUN_TEST_COMMAND,
                arguments: [test]
            }),
            new CodeLens(test.range, {
                title: 'Debug Test',
                command: Commands.JAVA_DEBUG_TEST_COMMAND,
                arguments: [test]
            })
        ];
    }).reduce((a, b) => a.concat(b));
}