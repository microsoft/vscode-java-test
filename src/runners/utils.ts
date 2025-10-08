// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, Range, TestItem, TestMessage, TestRun, Uri } from 'vscode';
import { JavaTestRunnerCommands } from '../constants';
import { asRange } from '../controller/utils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';
import * as path from 'path';
import { TestResultState } from '../java-test-runner.api';
import { TestReportGenerator } from '../reports/TestReportGenerator';

export async function findTestLocation(fullName: string): Promise<Location | undefined> {
    const location: any | undefined = await executeJavaLanguageServerCommand<any>(
        JavaTestRunnerCommands.FIND_TEST_LOCATION, fullName);
    if (location) {
        return new Location(Uri.parse(location.uri), asRange(location.range)!);
    }

    return undefined;
}

export function setTestState(testRun: TestRun, item: TestItem, result: TestResultState, message?: TestMessage | TestMessage[], duration?: number, reportGenerator?: TestReportGenerator): void {
    switch (result) {
        case TestResultState.Errored:
            testRun.errored(item, message || [], duration);
            if (reportGenerator) {
                const errorMessage = Array.isArray(message) 
                    ? message.map(m => typeof m.message === 'string' ? m.message : m.message.value).join('\n') 
                    : message ? (typeof message.message === 'string' ? message.message : message.message.value) : undefined;
                reportGenerator.recordErrored(item, duration, errorMessage);
            }
            break;
        case TestResultState.Failed:
            testRun.failed(item, message || [], duration);
            if (reportGenerator) {
                const errorMessage = Array.isArray(message) 
                    ? message.map(m => typeof m.message === 'string' ? m.message : m.message.value).join('\n') 
                    : message ? (typeof message.message === 'string' ? message.message : message.message.value) : undefined;
                reportGenerator.recordFailed(item, duration, errorMessage);
            }
            break;
        case TestResultState.Passed:
            testRun.passed(item, duration);
            if (reportGenerator) {
                reportGenerator.recordPassed(item, duration);
            }
            break;
        case TestResultState.Skipped:
            testRun.skipped(item);
            if (reportGenerator) {
                reportGenerator.recordSkipped(item);
            }
            break;
        case TestResultState.Running:
            testRun.started(item);
            if (reportGenerator) {
                reportGenerator.recordStarted(item);
            }
        default:
            break;
    }
}

/**
 * Append the line of stack trace to the traces.
 * @param lineOfMessage line of stack trace.
 * @param traces stack trace in markdown string.
 * @param currentItem current test item.
 * @param projectName project name.
 */
export function processStackTraceLine(lineOfMessage: string, traces: MarkdownString, currentItem: TestItem | undefined, projectName: string): Location | undefined {
    let testMessageLocation: Location | undefined;
    const traceResults: RegExpExecArray | null = /(\s?at\s+)([\w$\\.]+\/)?((?:[\w$]+\.)+[<\w$>]+)\((.*)\)/.exec(lineOfMessage);
    if (traceResults) {
        const fullyQualifiedName: string = traceResults[3];
        const location: string = traceResults[4];
        let sourceName: string | undefined;
        let lineNumLiteral: string | undefined;
        const locationResult: RegExpExecArray | null = /([\w-$]+\.java):(\d+)/.exec(location);
        if (locationResult) {
            sourceName = locationResult[1];
            lineNumLiteral = locationResult[2];
        }

        if (!sourceName || !lineNumLiteral) {
            traces.appendText(lineOfMessage);
        } else {
            const atLiteral: string = traceResults[1];
            const optionalModuleName: string = traceResults[2] || '';
            traces.appendText(atLiteral);
            traces.appendMarkdown(`${optionalModuleName + fullyQualifiedName}([${sourceName}:${lineNumLiteral}](command:_java.test.openStackTrace?${encodeURIComponent(JSON.stringify([lineOfMessage, projectName]))}))`);
            if (currentItem && path.basename(currentItem.uri?.fsPath || '') === sourceName) {
                const lineNum: number = parseInt(lineNumLiteral, 10);
                if (currentItem.uri) {
                    if (!currentItem.range || (currentItem.range.start.line + 1 < lineNum && currentItem.range.end.line + 1 > lineNum)) {
                        testMessageLocation = new Location(currentItem.uri, new Range(lineNum - 1, 0, lineNum, 0));
                    } else {
                        testMessageLocation = new Location(currentItem.uri, new Range(currentItem.range.start.line, 0, currentItem.range.start.line, 0));
                    }
                }
            }
        }
    } else {
        // '<' & '>' will be escaped when displaying the test message, so replacing them to '[' & ']'.
        traces.appendText(lineOfMessage.replace(/</g, '[').replace(/>/g, ']'));
    }
    traces.appendMarkdown('<br/>');

    return testMessageLocation
}
