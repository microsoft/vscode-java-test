// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ISearchTestItemParams, TestLevel } from '../protocols';

export function constructSearchTestItemParams(level: TestLevel, fullName: string, uri: string): ISearchTestItemParams {
    if (level === TestLevel.Root) {
        return {
            uri: '',
            level,
            fullName: '',
        };
    }

    return {
        uri,
        level,
        fullName,
    };
}

export function isTestMethodName(fullName: string): boolean {
    return fullName.includes('#');
}
