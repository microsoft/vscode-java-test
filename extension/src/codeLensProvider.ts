// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, TextDocument, Uri } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ITestItem, TestLevel } from './protocols';
import { ITestResultDetails, TestStatus } from './runners/models';
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
            const testItems: ITestItem[] = await searchTestCodeLens(document.uri.toString());
            const codeLenses: CodeLens[] = [];
            for (const testClass of testItems) {
                codeLenses.push(...this.getCodeLenses(testClass));
            }
            return codeLenses;
        } catch (error) {
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
                test.range,
                {
                    title: 'Run Test',
                    command: JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS,
                    tooltip: 'Run Test',
                    arguments: [[test]],
                },
            ),
            new CodeLens(
                test.range,
                {
                    title: 'Debug Test',
                    command: JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS,
                    tooltip: 'Debug Test',
                    arguments: [[test]],
                },
            ),
        );

        if (testResultManager.hasResultWithUri(Uri.parse(test.uri).fsPath)) {
            codeLenses.push(this.parseCodeLensForTestResult(test));
        }
        return codeLenses;
    }

    private parseCodeLensForTestResult(test: ITestItem): CodeLens {
        const testMethods: ITestItem[] = [];
        if (test.level === TestLevel.Method) {
            testMethods.push(test);
        } else {
            testMethods.push(...test.children.map((testChild: ITestItem) => testChild));
        }
        return new CodeLens(
            test.range,
            {
                title: this.getTestStatusIcon(testMethods),
                command: JavaTestRunnerCommands.SHOW_TEST_REPORT,
                tooltip: 'Show Report',
                arguments: [testMethods],
            },
        );
    }

    private getTestStatusIcon(testMethods: ITestItem[]): string {
        for (const method of testMethods) {
            const testResult: ITestResultDetails | undefined = testResultManager.getResult(Uri.parse(method.uri).fsPath, method.fullName);
            if (!testResult) {
                return '❓';
            } else if (testResult.status === TestStatus.Skip) {
                return '❔';
            } else if (testResult.status === TestStatus.Fail) {
                return '❌';
            }
        }

        return isDarwin() ? '✅' : '✔️';
    }
}

export const testCodeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
