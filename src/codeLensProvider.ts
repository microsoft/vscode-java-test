// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, TextDocument, Uri } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { logger } from './logger/logger';
import { ITestItem, TestLevel } from './protocols';
import { ITestResult, ITestResultDetails, TestStatus } from './runners/models';
import { testResultManager } from './testResultManager';
import { searchTestCodeLens } from './utils/commandUtils';
import { isDarwin } from './utils/platformUtils';

class TestCodeLensProvider implements CodeLensProvider {
    private onDidChangeCodeLensesEmitter: EventEmitter<void> = new EventEmitter<void>();

    get onDidChangeCodeLenses(): Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public async provideCodeLenses(document: TextDocument, _token: CancellationToken): Promise<CodeLens[]> {
        try {
            const testClasses: ITestItem[] = await searchTestCodeLens(document.uri.toString());
            const codeLenses: CodeLens[] = [];
            for (const testClass of testClasses) {
                codeLenses.push(...this.getCodeLenses(testClass));
            }
            return codeLenses;
        } catch (error) {
            logger.error('Failed to provide Code Lens', error);
            return [];
        }
    }

    private getCodeLenses(testClass: ITestItem): CodeLens[] {
        const result: CodeLens[] = [];
        result.push(...this.parseCodeLenses(testClass));
        if (testClass.children) {
            for (const testMethod of testClass.children) {
                result.push(...this.parseCodeLenses(testMethod));
            }
        }
        return result;
    }

    private parseCodeLenses(test: ITestItem): CodeLens[] {
        const codeLenses: CodeLens[] = [];
        codeLenses.push(
            new CodeLens(
                test.location.range,
                {
                    title: 'Run Test',
                    command: JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS,
                    tooltip: 'Run Test',
                    arguments: [[test]],
                },
            ),
            new CodeLens(
                test.location.range,
                {
                    title: 'Debug Test',
                    command: JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS,
                    tooltip: 'Debug Test',
                    arguments: [[test]],
                },
            ),
        );

        const resultLens: CodeLens | undefined = this.parseCodeLensForTestResult(test);
        if (resultLens) {
            codeLenses.push(resultLens);
        }
        return codeLenses;
    }

    private parseCodeLensForTestResult(test: ITestItem): CodeLens | undefined {
        const testResults: ITestResult[] = [];
        let details: ITestResultDetails | undefined;
        const totalNumber: number = this.getTotalMethodNumber(test);
        switch (test.level) {
            case TestLevel.Method:
                details = testResultManager.getResultDetails(Uri.parse(test.location.uri).fsPath, test.fullName);
                if (details) {
                    testResults.push(Object.assign({}, test, {details}));
                }
                break;
            case TestLevel.Class:
                if (!test.children) {
                    break;
                }
                const resultsInFsPath: Map<string, ITestResultDetails> | undefined = testResultManager.getResults(Uri.parse(test.location.uri).fsPath);
                if (!resultsInFsPath) {
                    break;
                }
                const testMethodMap: Map<string, ITestItem> = new Map<string, ITestItem>();
                for (const child of test.children) {
                    testMethodMap.set(child.fullName, child);
                }
                for (const key of resultsInFsPath.keys()) {
                    // Only consider the child-methods of the test item, inner class is not taken into consideration.
                    if (key.startsWith(`${test.fullName}#`)) {
                        testResults.push(Object.assign({fullName: key, displayName: key}, testMethodMap.get(key), { details: resultsInFsPath.get(key) as ITestResultDetails }));
                    }
                }
            default:
                break;
        }

        if (testResults.length) {
            return new CodeLens(
                test.location.range,
                {
                    title: this.getTestStatusIcon(testResults, totalNumber),
                    command: JavaTestRunnerCommands.SHOW_TEST_REPORT,
                    tooltip: 'Show Report',
                    arguments: [testResults],
                },
            );
        }

        return undefined;
    }

    private getTestStatusIcon(testResults: ITestResult[], totalNumber: number): string {
        let passedCount: number = 0;
        for (const result of testResults) {
            const details: ITestResultDetails = result.details;
            if (details.status === TestStatus.Fail) {
                return '❌';
            } else if (details.status === TestStatus.Pass) {
                passedCount++;
            }
        }

        if (passedCount < totalNumber) {
            return '?';
        }

        return isDarwin() ? '✅' : '✔️';
    }

    private getTotalMethodNumber(item: ITestItem): number {
        if (item.level === TestLevel.Method) {
            return 1;
        }
        if (item.level === TestLevel.Class) {
            if (item.children) {
                return item.children.length;
            }
        }
        return 0;
    }
}

export const testCodeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
