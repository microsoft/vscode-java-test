// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TextDocument } from "vscode";
import * as Commands from './commands';
import { TestSuite } from "./protocols";

export function fetchTests(document: TextDocument): Thenable<TestSuite[]> {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_FETCH_TEST, document.uri.toString()).then((tests: TestSuite[]) => {
        transformIndex(tests);
        return tests;
    },
    (reason) => {
        return Promise.reject(reason);
    });
}

export function searchAllTests(): Thenable<any> {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_SEARCH_ALL_TESTS).then((tests: TestSuite[]) => {
        transformIndex(tests);
        return tests;
    },
    (reason) => {
        return Promise.reject(reason);
    });
}

function transformIndex(tests: TestSuite[]): void {
    tests.map((t) => {
        if (t.parentIndex !== undefined) {
            t.parent = tests[t.parentIndex];
        }
        if (t.childrenIndices) {
            t.children = t.childrenIndices.map((i) => tests[i]);
        }
    });
}
