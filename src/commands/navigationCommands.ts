// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { commands, QuickPickItem, Uri, window } from 'vscode';
import { JavaTestRunnerCommands, JavaTestRunnerDelegateCommands } from '../constants';
import { testSourceProvider } from '../provider/testSourceProvider';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

export async function goToTest(): Promise<void> {
    if (!window.activeTextEditor) {
        return;
    }
    const uri: Uri = window.activeTextEditor.document.uri;
    if (await testSourceProvider.isOnTestSourcePath(uri)) {
        return;
    }
    const results: ITestFindResult[] = await searchTests(uri.toString());
    if (!results.length) {
        window.showQuickPick([
            'Generate tests...',
            'Search test files...',
        ], {
            placeHolder: 'No tests found for current source file'
        }).then((choice: string | undefined) => {
            if (choice === 'Search test files...') {
                const fileName: string = path.basename(window.activeTextEditor!.document.fileName);
                commands.executeCommand('workbench.action.quickOpen', fileName.substring(0, fileName.lastIndexOf('.')));
            } else if (choice === 'Generate tests...') {
                commands.executeCommand(JavaTestRunnerCommands.JAVA_TEST_GENERATE_TESTS, uri, 0);
            }
        });
    } else if (results.length === 1) {
        window.showTextDocument(Uri.parse(results[0].uri));
    } else {
        const items: IResultItem[] = results.sort((a: ITestFindResult, b: ITestFindResult) => {
            return a.simpleName.localeCompare(b.simpleName);
        }).map((r: ITestFindResult) => {
            return {
                label: r.simpleName,
                detail: r.fullyQualifiedName,
                uri: r.uri,
            };
        });
        window.showQuickPick(items, {
            placeHolder: 'Choose a test class to open',
        }).then((choice: IResultItem | undefined) => {
            if (choice) {
                window.showTextDocument(Uri.parse(choice.uri));
            }
        });
    }
}

async function searchTests(uri: string): Promise<ITestFindResult[]> {
    return await executeJavaLanguageServerCommand<ITestFindResult[]>(
        JavaTestRunnerDelegateCommands.NAVIGATE_TO_TEST_OR_TARGET, uri, true) || [];
}

interface ITestFindResult {
    simpleName: string;
    fullyQualifiedName: string;
    uri: string;
}

interface IResultItem extends QuickPickItem {
    uri: string;
}
