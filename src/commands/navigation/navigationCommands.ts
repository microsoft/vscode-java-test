// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { commands, extensions, Location, Range, Uri, window } from 'vscode';
import { JavaTestRunnerCommands, JavaTestRunnerDelegateCommands, VSCodeCommands } from '../../constants';
import { testSourceProvider } from '../../provider/testSourceProvider';
import { SymbolTree } from '../../references-view';
import { executeJavaLanguageServerCommand } from '../../utils/commandUtils';
import { IOption } from '../askForOptionCommands';
import { TestNavigationInput } from './testNavigationInput';

const GENERATE_TESTS: string = 'Generate tests...';
const SEARCH_TEST_FILES: string = 'Search test files...';
const REFERENCES_VIEW_EXTENSION: string = 'ms-vscode.references-view';

export async function goToTest(): Promise<void> {
    if (!window.activeTextEditor) {
        return;
    }
    const uri: Uri = window.activeTextEditor.document.uri;
    if (await testSourceProvider.isOnTestSourcePath(uri)) {
        return;
    }
    const result: ITestNavigationResult | undefined = await searchTests(uri.toString());
    if (!result?.items?.length) {
        window.showQuickPick([
            GENERATE_TESTS,
            SEARCH_TEST_FILES,
        ], {
            placeHolder: 'No tests found for current source file'
        }).then((choice: string | undefined) => {
            if (choice === SEARCH_TEST_FILES) {
                const fileName: string = path.basename(window.activeTextEditor!.document.fileName);
                commands.executeCommand(VSCodeCommands.WORKBENCH_ACTION_QUICK_OPEN, fileName.substring(0, fileName.lastIndexOf('.')));
            } else if (choice === GENERATE_TESTS) {
                commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_GENERATE_TESTS, uri, 0);
            }
        });
    } else if (result.items.length === 1) {
        window.showTextDocument(Uri.parse(result.items[0].uri));
    } else {
        const sortedResults: ITestNavigationItem[] = result.items.sort((a: ITestNavigationItem, b: ITestNavigationItem) => {
            if (a.outOfBelongingProject && !b.outOfBelongingProject) {
                return Number.MAX_SAFE_INTEGER;
            } else if (!a.outOfBelongingProject && b.outOfBelongingProject) {
                return Number.MIN_SAFE_INTEGER;
            } else {
                if (a.relevance === b.relevance) {
                    return a.simpleName.localeCompare(b.simpleName);
                }
                return a.relevance - b.relevance;
            }
        });
        const api: SymbolTree | undefined = await extensions.getExtension<SymbolTree>(REFERENCES_VIEW_EXTENSION)?.activate();
        if (api) {
            const input: TestNavigationInput = new TestNavigationInput(
                'Related Tests',
                new Location(uri, new Range(
                    result.location.range.start.line,
                    result.location.range.start.character,
                    result.location.range.end.line,
                    result.location.range.end.line,
                )),
                sortedResults
            );
            api.setInput(input);
        } else {
            goToTestFallback(sortedResults);
        }
    }
}

async function goToTestFallback(results: ITestNavigationItem[]): Promise<void> {
    const items: IOption[] = results.map((r: ITestNavigationItem) => {
        return {
            label: r.simpleName,
            detail: r.fullyQualifiedName,
            value: r.uri,
            isAdvanced: r.outOfBelongingProject,
        };
    });
    const choice: string[] | undefined = await commands.executeCommand(
        JavaTestRunnerCommands.ADVANCED_ASK_CLIENT_FOR_CHOICE,
        'Choose a test class to open',
        items,
        'tests in other projects',
        false,
    );
    if (choice?.length) {
        window.showTextDocument(Uri.parse(choice[0]));
    }
}

async function searchTests(uri: string): Promise<ITestNavigationResult | undefined> {
    return await executeJavaLanguageServerCommand<ITestNavigationResult | undefined>(
        JavaTestRunnerDelegateCommands.NAVIGATE_TO_TEST_OR_TARGET, uri, true);
}

export interface ITestNavigationResult {
    items: ITestNavigationItem[];
    location: Location;
}

export interface ITestNavigationItem {
    simpleName: string;
    fullyQualifiedName: string;
    uri: string;
    relevance: number;
    outOfBelongingProject: boolean;
}
