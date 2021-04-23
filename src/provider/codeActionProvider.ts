// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Disposable, DocumentSelector, languages, Range, RelativePattern, Selection, TextDocument } from 'vscode';
import { testSourceProvider } from '../../extension.bundle';
import { parseDocumentSelector } from '../utils/uiUtils';

let provider: Disposable;
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

export async function registerTestCodeActionProvider(): Promise<void> {
    if (provider) {
        provider.dispose();
    }
    const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern(false /*containsGeneralProject*/);
    const documentSelector: DocumentSelector = parseDocumentSelector(patterns);
    provider = languages.registerCodeActionsProvider(
        documentSelector,
        new TestCodeActionProvider(),
        { providedCodeActionKinds: [CodeActionKind.Source.append('generate.tests')] },
    );
}
