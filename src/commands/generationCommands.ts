// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Position, Range, SnippetString, SnippetTextEdit, TextEdit, Uri, window, workspace, WorkspaceEdit, WorkspaceEditEntryMetadata } from 'vscode';
import { AnnotatedTextEdit, ChangeAnnotation, CreateFile, DeleteFile, RenameFile, SnippetTextEdit as ProtocolSnippetTextEdit, TextDocumentEdit, TextEdit as ProtocolTextEdit, WorkspaceEdit as ProtocolWorkspaceEdit } from 'vscode-languageserver-types';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

export async function generateTests(uri: Uri, cursorOffset: number): Promise<void> {
    const protocolEdit: ProtocolWorkspaceEdit | undefined = await askServerToGenerateTests(uri, cursorOffset);
    const edit: WorkspaceEdit | undefined = protocolEdit && asWorkspaceEdit(protocolEdit);
    if (edit) {
        await workspace.applyEdit(edit);
        const entries: [Uri, TextEdit[]][] = edit.entries();
        if (entries?.[0]?.[0]) {
            await window.showTextDocument(entries[0][0], {
                preserveFocus: true,
            });
        }
    }
}

export function asWorkspaceEdit(protocolEdit: ProtocolWorkspaceEdit): WorkspaceEdit {
    const edit: WorkspaceEdit = new WorkspaceEdit();
    const metadata: (annotationId?: string) => WorkspaceEditEntryMetadata | undefined = (annotationId?: string): WorkspaceEditEntryMetadata | undefined => {
        const annotation: ChangeAnnotation | undefined = annotationId ? protocolEdit.changeAnnotations?.[annotationId] : undefined;
        return annotation && {
            label: annotation.label,
            needsConfirmation: !!annotation.needsConfirmation,
            description: annotation.description,
        };
    };

    if (protocolEdit.documentChanges) {
        for (const change of protocolEdit.documentChanges) {
            if (CreateFile.is(change)) {
                edit.createFile(Uri.parse(change.uri), change.options, metadata(change.annotationId));
            } else if (RenameFile.is(change)) {
                edit.renameFile(Uri.parse(change.oldUri), Uri.parse(change.newUri), change.options, metadata(change.annotationId));
            } else if (DeleteFile.is(change)) {
                edit.deleteFile(Uri.parse(change.uri), change.options, metadata(change.annotationId));
            } else if (TextDocumentEdit.is(change)) {
                const edits: [TextEdit | SnippetTextEdit, WorkspaceEditEntryMetadata | undefined][] = change.edits.map(
                    (textEdit: ProtocolTextEdit | AnnotatedTextEdit | ProtocolSnippetTextEdit): [TextEdit | SnippetTextEdit, WorkspaceEditEntryMetadata | undefined] => {
                        const range: Range = new Range(
                            new Position(textEdit.range.start.line, textEdit.range.start.character),
                            new Position(textEdit.range.end.line, textEdit.range.end.character),
                        );
                        if (ProtocolSnippetTextEdit.is(textEdit)) {
                            return [new SnippetTextEdit(range, new SnippetString(textEdit.snippet.value)), metadata(textEdit.annotationId)];
                        }
                        return [new TextEdit(range, textEdit.newText), metadata(AnnotatedTextEdit.is(textEdit) ? textEdit.annotationId : undefined)];
                    },
                );
                edit.set(Uri.parse(change.textDocument.uri), edits);
            } else {
                throw new Error(`Unknown workspace edit change received: ${JSON.stringify(change)}`);
            }
        }
    } else if (protocolEdit.changes) {
        for (const uri of Object.keys(protocolEdit.changes)) {
            const textEdits: ProtocolTextEdit[] = protocolEdit.changes[uri];
            edit.set(Uri.parse(uri), textEdits.map((textEdit: ProtocolTextEdit) => new TextEdit(
                new Range(
                    new Position(textEdit.range.start.line, textEdit.range.start.character),
                    new Position(textEdit.range.end.line, textEdit.range.end.character),
                ),
                textEdit.newText,
            )));
        }
    }
    return edit;
}

async function askServerToGenerateTests(uri: Uri, cursorOffset: number): Promise<ProtocolWorkspaceEdit | undefined> {
    return await executeJavaLanguageServerCommand<ProtocolWorkspaceEdit | undefined>(JavaTestRunnerDelegateCommands.GENERATE_TESTS, uri.toString(), cursorOffset);
}
