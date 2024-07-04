// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Range } from 'vscode';
import { TestKind, TestLevel } from './java-test-runner.api';

export interface IJavaTestItem {
    children: IJavaTestItem[];
    uri: string | undefined;
    range: Range | undefined;
    jdtHandler: string;
    fullName: string;
    label: string;
    id: string;
    projectName: string;
    testKind: TestKind;
    testLevel: TestLevel;
    /**
     * Provides a hint to the UI on how to sort tests.
     */
    sortText?: string;
    /**
     * Identifies a single invocation of a parameterized test.
     * Invocations for which a re-run is possible store their own uniqueId which is provided as part of the result.
     * Methods may store it in order to specify a certain parameter-set to be used when running again.
     */
    uniqueId?: string;
    /**
     * Optional fields for projects
     */
    natureIds?: string[];
}

export enum ProjectType {
    Gradle,
    Maven,
    UnmanagedFolder,
    Other,
}
