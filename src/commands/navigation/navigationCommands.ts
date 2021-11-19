// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { commands, extensions, Location, Range, Uri, window } from 'vscode';
import { JavaTestRunnerCommands, JavaTestRunnerDelegateCommands, VSCodeCommands } from '../../constants';
import { SymbolTree } from '../../references-view';
import { executeJavaLanguageServerCommand } from '../../utils/commandUtils';
import { IOption } from '../askForOptionCommands';
import { TestNavigationInput } from './testNavigationInput';

const GENERATE_TESTS: string = 'Generate tests...';
const SEARCH_FILES: string = 'Search files...';
const REFERENCES_VIEW_EXTENSION: string = 'ms-vscode.references-view';

export async function navigateToTestOrTarget(gotoTest: boolean): Promise<void> {
    if (!window.activeTextEditor) {
        return;
    }
    const uri: Uri = window.activeTextEditor.document.uri;
    const result: ITestNavigationResult | undefined = await searchTestOrTarget(uri.toString(), gotoTest);
    if (!result?.items?.length) {
        const items: string[] = [SEARCH_FILES];
        if (gotoTest) {
            items.unshift(GENERATE_TESTS);
        }
        window.showQuickPick(items, {
            placeHolder: `${gotoTest ? 'Tests' : 'Test subjects'} not found for current file`,
        }).then((choice: string | undefined) => {
            if (choice === SEARCH_FILES) {
                let fileName: string = path.basename(window.activeTextEditor!.document.fileName);
                if (!gotoTest) {
                    fileName = fileName.replace(/Tests?/g, '');
                }
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
            const title: string = gotoTest ? 'Tests' : 'Test Subjects';
            const input: TestNavigationInput = new TestNavigationInput(
                title,
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
            fallbackForNavigation(sortedResults);
        }
    }
}

async function fallbackForNavigation(results: ITestNavigationItem[]): Promise<void> {
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
        'Choose a class to open',
        items,
        'Classes in other projects',
        false,
    );
    if (choice?.length) {
        window.showTextDocument(Uri.parse(choice[0]));
    }
}

async function searchTestOrTarget(uri: string, gotoTest: boolean): Promise<ITestNavigationResult | undefined> {
    return await executeJavaLanguageServerCommand<ITestNavigationResult | undefined>(
        JavaTestRunnerDelegateCommands.NAVIGATE_TO_TEST_OR_TARGET, uri, gotoTest);
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
