// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Range, Selection, TextDocument } from 'vscode';
import { getSourcePaths } from './utils/commandUtils';

export class TestCodeActionProvider implements CodeActionProvider {

    private sourcePaths: ISourcePath[];

    public async provideCodeActions(document: TextDocument, range: Range | Selection, _context: CodeActionContext, token: CancellationToken): Promise<CodeAction[] | null> {
        if (!this.sourcePaths) {
            this.sourcePaths = await getSourcePaths();
        }

        if (token.isCancellationRequested) {
            return null;
        }

        const filePath: string = document.uri.fsPath;
        for (const sourcePath of this.sourcePaths) {
            if (!path.relative(sourcePath.path, filePath).startsWith('..')) {
                return [this.getCodeAction(document, range)];
            }
        }
        return null;
    }

    private getCodeAction(document: TextDocument, range: Range | Selection): CodeAction {
        const start: number = document.offsetAt(range.start);
        const codeAction: CodeAction = new CodeAction('Generate tests...', CodeActionKind.Source.append('generate.tests'));
        codeAction.command = {
            title: 'Generate Tests...',
            command: 'java.test.generateTests',
            arguments: [document.uri, start],
        };
        // This is only to make sure the rank of the code actions will not jitter
        // See: https://github.com/microsoft/vscode/issues/62267
        codeAction.isPreferred = true;
        return codeAction;
    }
}

interface ISourcePath {
    path: string;
    displayPath: string;
    projectName: string;
    projectType: string;
}
