// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { ISearchChildrenNodeRequest } from '../protocols';

export function serializeSearchChildrenNodeRequest(node: TestTreeNode): string {
    const searchRequest: ISearchChildrenNodeRequest = {
        uri: Uri.file(node.fsPath).toString(),
        level: node.level,
        fullName: node.fullName,
    };
    return JSON.stringify(searchRequest);
}
