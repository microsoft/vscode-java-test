// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, TextDocument } from 'vscode';
import { TestResourceManager } from './testResourceManager';
import * as Commands from './Constants/commands';
import { TestStatus, TestSuite } from './Models/protocols';
import * as FetchTestsUtility from './Utils/fetchTestUtility';
import * as Logger from './Utils/Logger/logger';

export class JUnitCodeLensProvider implements CodeLensProvider {
    constructor(
        private _onDidChange: EventEmitter<void>,
        private _testCollectionStorage: TestResourceManager) {
    }

    get onDidChangeCodeLenses(): Event<void> {
        return this._onDidChange.event;
    }

    public async provideCodeLenses(document: TextDocument, token: CancellationToken) {
        return FetchTestsUtility.fetchTests(document).then((tests: TestSuite[]) => {
            this._testCollectionStorage.storeTests(document.uri, tests);
            return getCodeLens(tests);
        },
        (reason) => {
            if (token.isCancellationRequested) {
                Logger.error('test codelens request is cancelled.', undefined, true);
                return [];
            }
            Logger.error(`Failed to get test codelens. Details: ${reason}.`);
            return Promise.reject(reason);
        });
    }
}

function getTestStatusIcon(status?: TestStatus): string {
    const isMac = /^darwin/.test(process.platform);
    switch (status) {
        case TestStatus.Pass: {
            return isMac ? '✅' : '✔️';
        }
        case TestStatus.Fail: {
            return '❌';
        }
        case TestStatus.Skipped: {
            return '❔';
        }
        default: {
            return '❓';
        }
    }
}

function getCodeLens(tests: TestSuite[]): CodeLens[] {
    return tests.map((test) => {
        const codeLenses = [
            new CodeLens(test.range, {
                title: 'Run Test',
                command: Commands.JAVA_RUN_TEST_COMMAND,
                tooltip: 'Run Test',
                arguments: [test],
            }),
            new CodeLens(test.range, {
                title: 'Debug Test',
                command: Commands.JAVA_DEBUG_TEST_COMMAND,
                tooltip: 'Debug Test',
                arguments: [test],
            }),
        ];

        if (test.result) {
            codeLenses.push(new CodeLens(test.range, {
                title: getTestStatusIcon(test.result.status),
                command: Commands.JAVA_TEST_SHOW_REPORT,
                tooltip: 'Show Report',
                arguments: [test],
            }));
        }

        return codeLenses;
    }).reduce((a, b) => a.concat(b), []);
}
