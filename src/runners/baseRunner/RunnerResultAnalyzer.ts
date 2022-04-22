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

    /**
     * Return a string array which contains the stacktraces that need to be filtered.
     * All the stacktraces which include the element in the return array will be removed.
     */
    protected getStacktraceFilter(): string[] {
        return [];
    }

    protected processStackTrace(data: string, traces: MarkdownString, assertionFailure: TestMessage | undefined, currentItem: TestItem | undefined, projectName: string): void {
        const traceRegExp: RegExp = /(\s?at\s+)([\w$\\.]+\/)?((?:[\w$]+\.)+[<\w$>]+)\((.*)\)/;
        const traceResults: RegExpExecArray | null = traceRegExp.exec(data);
        if (traceResults) {
            const fullyQualifiedName: string = traceResults[3];
            if (this.isExcluded(fullyQualifiedName)) {
                return;
            }

            const location: string = traceResults[4];
            let sourceName: string | undefined;
            let lineNumLiteral: string | undefined;
            const locationResult: RegExpExecArray | null = /([\w-$]+\.java):(\d+)/.exec(location);
            if (locationResult) {
                sourceName = locationResult[1];
                lineNumLiteral = locationResult[2];
            }

            if (!sourceName || !lineNumLiteral) {
                traces.appendText(data);
            } else {
                const atLiteral: string = traceResults[1];
                const optionalModuleName: string = traceResults[2] || '';
                traces.appendText(atLiteral);
                traces.appendMarkdown(`${optionalModuleName + fullyQualifiedName}([${sourceName}:${lineNumLiteral}](command:_java.test.openStackTrace?${encodeURIComponent(JSON.stringify([data, projectName]))}))`);
                if (currentItem && path.basename(currentItem.uri?.fsPath || '') === sourceName) {
                    const lineNum: number = parseInt(lineNumLiteral, 10);
                    if (currentItem.uri) {
                        if (!currentItem.range || (currentItem.range.start.line + 1 < lineNum && currentItem.range.end.line + 1 > lineNum)) {
                            this.testMessageLocation = new Location(currentItem.uri, new Range(lineNum - 1, 0, lineNum, 0));
                        } else {
                            this.testMessageLocation = new Location(currentItem.uri, new Range(currentItem.range.start.line, 0, currentItem.range.start.line, 0));
                        }
                    }
                    if (assertionFailure) {
                        assertionFailure.location = this.testMessageLocation;
                        setTestState(this.testContext.testRun, currentItem, TestResultState.Failed, assertionFailure);
                    }
                }
            }
        } else {
            // '<' & '>' will be escaped when displaying the test message, so replacing them to '[' & ']'.
            traces.appendText(data.replace(/</g, '[').replace(/>/g, ']'));
        }
        traces.appendMarkdown('<br/>');
    }

    private isExcluded(stacktrace: string): boolean {
        return this.getStacktraceFilter().some((s: string) => {
            return stacktrace.includes(s);
        });
    }
}
