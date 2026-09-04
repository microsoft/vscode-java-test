// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { SnippetTextEdit, TextEdit, Uri, WorkspaceEdit } from 'vscode';
import { WorkspaceEdit as ProtocolWorkspaceEdit } from 'vscode-languageserver-types';
import { asWorkspaceEdit } from '../../src/commands/generationCommands';

suite('Generation Commands Tests', () => {
    test('converts protocol changes to VS Code text edits', () => {
        const uri: Uri = Uri.file('/workspace/AppTest.java');
        const protocolEdit: ProtocolWorkspaceEdit = {
            changes: {
                [uri.toString()]: [{
                    range: { start: { line: 1, character: 2 }, end: { line: 3, character: 4 } },
                    newText: 'generated',
                }],
            },
        };

        const entries = asWorkspaceEdit(protocolEdit).entries();

        assert.strictEqual(entries.length, 1);
        assert.strictEqual(entries[0][0].toString(), uri.toString());
        assert.ok(entries[0][1][0] instanceof TextEdit);
        assert.strictEqual(entries[0][1][0].newText, 'generated');
        assert.strictEqual(entries[0][1][0].range.start.line, 1);
        assert.strictEqual(entries[0][1][0].range.start.character, 2);
        assert.strictEqual(entries[0][1][0].range.end.line, 3);
        assert.strictEqual(entries[0][1][0].range.end.character, 4);
    });

    test('converts annotated document and resource changes', () => {
        const uri: Uri = Uri.file('/workspace/GeneratedTest.java');
        const protocolEdit: ProtocolWorkspaceEdit = {
            changeAnnotations: {
                generated: { label: 'Generate test', needsConfirmation: true },
            },
            documentChanges: [
                { kind: 'create', uri: uri.toString(), annotationId: 'generated' },
                {
                    textDocument: { uri: uri.toString(), version: null },
                    edits: [{
                        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                        snippet: { kind: 'snippet', value: 'class ${1:GeneratedTest} {}' },
                        annotationId: 'generated',
                    }],
                },
            ],
        };

        const setSpy = sinon.spy(WorkspaceEdit.prototype, 'set');

        try {
            asWorkspaceEdit(protocolEdit);

            assert.ok(setSpy.calledOnce);
            assert.strictEqual(setSpy.firstCall.args[0].toString(), uri.toString());
            const convertedEdit: unknown = setSpy.firstCall.args[1][0][0];
            assert.ok(convertedEdit instanceof SnippetTextEdit);
            assert.strictEqual(convertedEdit.snippet.value, 'class ${1:GeneratedTest} {}');
        } finally {
            setSpy.restore();
        }
    });
});
