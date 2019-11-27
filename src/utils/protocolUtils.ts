// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ISearchTestItemParams, ITestItem, TestLevel } from '../protocols';

export function constructSearchTestItemParams(node: ITestItem): ISearchTestItemParams {
    if (node.level === TestLevel.Root) {
        return {
            uri: '',
            level: TestLevel.Root,
            fullName: '',
        };
    }

    return {
        uri: node.location.uri,
        level: node.level,
        fullName: node.fullName,
    };
}

export function isTestMethodName(fullName: string): boolean {
    return fullName.includes('#');
}
