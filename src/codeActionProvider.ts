// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Range, Selection, TextDocument } from 'vscode';

export class TestCodeActionProvider implements CodeActionProvider {

    public async provideCodeActions(document: TextDocument, range: Range | Selection, _context: CodeActionContext, _token: CancellationToken): Promise<CodeAction[] | null> {
        return [this.getCodeAction(document, range)];
    }

    private getCodeAction(document: TextDocument, range: Range | Selection): CodeAction {
        const offset: number = document.offsetAt(range.start);
        const codeAction: CodeAction = new CodeAction('Generate Tests...', CodeActionKind.Source.append('generate.tests'));
        codeAction.command = {
            title: 'Generate Tests...',
            command: 'java.test.generateTests',
            arguments: [document.uri, offset],
        };
        // This is only to make sure the rank of the code actions will not jitter
        // See: https://github.com/microsoft/vscode/issues/62267
        codeAction.isPreferred = true;
        return codeAction;
    }
}
