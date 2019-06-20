// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { ISearchTestItemParams, TestLevel } from '../protocols';

export function constructSearchTestItemParams(node?: TestTreeNode): ISearchTestItemParams {
    if (node) {
        return {
            uri: Uri.file(node.fsPath).toString(),
            level: node.level,
            fullName: node.fullName,
        };
    }
    return {
        uri: '',
        level: TestLevel.Root,
        fullName: '',
    };
}

export function isTestMethodName(fullName: string): boolean {
    return fullName.includes('#');
}
