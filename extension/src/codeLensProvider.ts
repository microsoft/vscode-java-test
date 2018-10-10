// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, TextDocument } from 'vscode';
import { JavaTestRunnerCommands } from './constants/commands';
import { ITestItem } from './protocols';
import { searchTestCodeLens } from './utils/commandUtils';

class TestCodeLensProvider implements CodeLensProvider {
    private _onDidChangeCodeLenses: EventEmitter<void> = new EventEmitter<void>();

    get onDidChangeCodeLenses(): Event<void> {
        return this._onDidChangeCodeLenses.event;
    }

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
        try {
            const testItems: ITestItem[] = await searchTestCodeLens(document.uri.toString());
            const codeLenses: CodeLens[] = [];
            for (const test of testItems) {
                if (token.isCancellationRequested) {
                    break;
                }
                codeLenses.push(...this.getCodeLenses(test));
            }
            return codeLenses;
        } catch (error) {
            return [];
        }
    }

    private getCodeLenses(test: ITestItem): CodeLens[] {
        const result: CodeLens[] = [];
        result.push(...this.parseCodeLenses(test));
        if (test.children) {
            for (const child of test.children) {
                result.push(...this.parseCodeLenses(child));
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
