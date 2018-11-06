// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { ISearchTestItemParams } from '../protocols';

export function constructSearchTestItemParams(node: TestTreeNode): ISearchTestItemParams {
    return {
        uri: Uri.file(node.fsPath).toString(),
        level: node.level,
        fullName: node.fullName,
    };
}
