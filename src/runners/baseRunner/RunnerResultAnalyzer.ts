// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, TestItem } from 'vscode';
import { IRunTestContext } from '../../java-test-runner.api';
import { TestReportGenerator } from '../../reports/TestReportGenerator';
import { processStackTraceLine } from '../utils';

export abstract class RunnerResultAnalyzer {
    protected reportGenerator?: TestReportGenerator;

    constructor(protected testContext: IRunTestContext) { }

    public setReportGenerator(reportGenerator: TestReportGenerator): void {
        this.reportGenerator = reportGenerator;
    }

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

    protected processStackTrace(data: string, traces: MarkdownString, currentItem: TestItem | undefined, projectName: string): void {
        if (this.isExcluded(data)) {
            return;
        }

        const location: Location | undefined = processStackTraceLine(data, traces, currentItem, projectName);
        if (location) {
            this.testMessageLocation = location;
        }
    }

    private isExcluded(stacktrace: string): boolean {
        return this.getStacktraceFilter().some((s: string) => {
            return stacktrace.includes(s);
        });
    }
}
