// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { Location, MarkdownString, Range, TestItem, TestMessage } from 'vscode';
import { IRunTestContext } from '../../types';
import { setTestState, TestResultState } from '../utils';

export abstract class RunnerResultAnalyzer {
    constructor(protected testContext: IRunTestContext) { }

    public abstract analyzeData(data: string): void;
    public abstract processData(data: string): void;
    protected testMessageLocation: Location | undefined;

    protected processStackTrace(data: string, traces: MarkdownString, assertionFailure: TestMessage | undefined, currentItem: TestItem | undefined, projectName: string): void {
        const traceRegExp: RegExp = /(\s?at\s+)([\w$\\.]+\/)?((?:[\w$]+\.)+[<\w$>]+)\(([\w-$]+\.java):(\d+)\)/;

        const traceResults: RegExpExecArray | null = traceRegExp.exec(data);
        if (traceResults && traceResults.length === 6) {
            traces.appendText(traceResults[1]);
            traces.appendMarkdown(`${(traceResults[2] || '') + traceResults[3]}([${traceResults[4]}:${traceResults[5]}](command:_java.test.openStackTrace?${encodeURIComponent(JSON.stringify([data, projectName]))}))`);
            if (currentItem && path.basename(currentItem.uri?.fsPath || '') === traceResults[4]) {
                const lineNum: number = parseInt(traceResults[5], 10);
                if (currentItem.uri) {
                    this.testMessageLocation = new Location(currentItem.uri, new Range(lineNum - 1, 0, lineNum, 0));
                }
                if (assertionFailure) {
                    assertionFailure.location = this.testMessageLocation;
                    setTestState(this.testContext.testRun, currentItem, TestResultState.Failed, assertionFailure);
                }
            }
        } else {
            // '<' & '>' will be escaped when displaying the test message, so replacing them to '[' & ']'.
            traces.appendText(data.replace(/</g, '[').replace(/>/g, ']'));
        }
        traces.appendMarkdown('<br/>');
    }
}
