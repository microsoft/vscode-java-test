// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { Location, MarkdownString, Range, TestItem, TestMessage } from 'vscode';
import { INVOCATION_PREFIX } from '../../constants';
import { IRunTestContext } from '../../types';
import { findTestLocation, setTestState, TestResultState } from '../utils';

export abstract class RunnerResultAnalyzer {
    constructor(protected testContext: IRunTestContext) { }

    public abstract analyzeData(data: string): void;
    public abstract processData(data: string): void;

    protected processStackTrace(data: string, traces: MarkdownString, testMessage: TestMessage | undefined, currentItem: TestItem | undefined, projectName: string): void {
        const traceRegExp: RegExp = /(\s?at\s+)([\w$\\.]+\/)?((?:[\w$]+\.)+[<\w$>]+)\(([\w-$]+\.java):(\d+)\)/;

        const traceResults: RegExpExecArray | null = traceRegExp.exec(data);
        if (traceResults && traceResults.length === 6) {
            traces.appendText(traceResults[1]);
            traces.appendMarkdown(`${(traceResults[2] || '') + traceResults[3]}([${traceResults[4]}:${traceResults[5]}](command:_java.test.openStackTrace?${encodeURIComponent(JSON.stringify([data, projectName]))}))`);
            if (testMessage && currentItem && path.basename(currentItem.uri?.fsPath || '') === traceResults[4]) {
                testMessage.message = data.trim();
                const lineNum: number = parseInt(traceResults[5], 10);
                if (currentItem.uri) {
                    testMessage.location = new Location(currentItem.uri, new Range(lineNum - 1, 0, lineNum, 0));
                }
                setTestState(this.testContext.testRun, currentItem, TestResultState.Failed, testMessage);
            }
        } else {
            // in case the message contains message like: 'expected: <..> but was: <..>'
            traces.appendText(data.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
        traces.appendText('\n');
    }

    protected async finishFailureMessage(item: TestItem | undefined, testMessage: TestMessage, duration?: number): Promise<void> {
        if (item) {
            if (item.uri && item.range) {
                testMessage.location = new Location(item.uri, item.range);
            } else {
                let id: string = item.id;
                if (id.startsWith(INVOCATION_PREFIX)) {
                    id = id.substring(INVOCATION_PREFIX.length);
                }
                const location: Location | undefined = await findTestLocation(id);
                testMessage.location = location;
            }
            setTestState(this.testContext.testRun, item, TestResultState.Failed, testMessage, duration);
        }
    }
}
