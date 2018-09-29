// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TextDocument, Uri, window, workspace } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';

export async function openTextDocumentForNode(node: TestTreeNode): Promise<void> {
    const document: TextDocument = await workspace.openTextDocument(Uri.file(node.fsPath));
    await window.showTextDocument(document, {preserveFocus: true, selection: node.range});
}
