// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeLens, CodeLensProvider, EventEmitter, TextDocument } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ITestItem } from './protocols';
import { searchTestCodeLens } from './utils/commandUtils';

class TestCodeLensProvider implements CodeLensProvider {
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
        return [
            new CodeLens(
                test.range,
                {
                    title: 'Run Test',
                    command: JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS,
                    tooltip: 'Run Test',
                    arguments: [test],
                },
            ),
            new CodeLens(
                test.range,
                {
                    title: 'Debug Test',
                    command: JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS,
                    tooltip: 'Debug Test',
                    arguments: [test],
                },
            ),
        ];
    }
}

export const testCodeLensProvider: TestCodeLensProvider = new TestCodeLensProvider();
