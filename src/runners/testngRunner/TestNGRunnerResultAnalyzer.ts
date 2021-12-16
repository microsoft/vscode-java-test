// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, TestItem, TestMessage } from 'vscode';
import { dataCache } from '../../controller/testItemDataCache';
import { IRunTestContext, TestLevel } from '../../types';
import { RunnerResultAnalyzer } from '../baseRunner/RunnerResultAnalyzer';
import { setTestState, TestResultState } from '../utils';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class TestNGRunnerResultAnalyzer extends RunnerResultAnalyzer {

    private readonly regex: RegExp = /@@<TestRunner-({[\s\S]*?})-TestRunner>/g;

    private triggeredTestsMapping: Map<string, TestItem> = new Map();
    private currentTestState: TestResultState;
    private currentItem: TestItem | undefined;
    private projectName: string;

    constructor(protected testContext: IRunTestContext) {
        super(testContext);
        this.projectName = testContext.projectName;
        const queue: TestItem[] = [...testContext.testItems];
        while (queue.length) {
            const item: TestItem = queue.shift()!;
            const testLevel: TestLevel | undefined = dataCache.get(item)?.testLevel;
            if (testLevel === undefined) {
                continue;
            }
            if (testLevel === TestLevel.Method) {
                this.triggeredTestsMapping.set(item.id, item);
            } else {
                item.children.forEach((child: TestItem) => {
                    queue.push(child);
                });
            }
        }
    }

    public analyzeData(data: string): void {
        let match: RegExpExecArray | null;
        // tslint:disable-next-line: no-conditional-assignment
        while ((match = this.regex.exec(data)) !== null) {
            try {
               this.processData(match[1]);
            } catch (error) {
                this.testContext.testRun.appendOutput(`[ERROR] Failed to parse output data: ${match[1]}\n`);
            }
        }
    }

    public processData(data: string): void {
        const outputData: ITestNGOutputData = JSON.parse(data) as ITestNGOutputData;

        this.testContext.testRun.appendOutput(this.unescape(data).replace(/\r?\n/g, '\r\n'));

        const id: string = `${this.projectName}@${outputData.attributes.name}`;
        if (outputData.name === TEST_START) {
            this.initializeCache();
            const item: TestItem | undefined = this.getTestItem(id);
            if (!item) {
                return;
            }
            this.currentTestState = TestResultState.Running;
            this.testContext.testRun.started(item);
        } else if (outputData.name === TEST_FAIL) {
            const item: TestItem | undefined = this.getTestItem(id);
            if (!item) {
                return;
            }
            this.currentTestState = TestResultState.Failed;
            const testMessages: TestMessage[] = [];

            if (outputData.attributes.trace) {
                const markdownTrace: MarkdownString = new MarkdownString();
                markdownTrace.isTrusted = true;
                markdownTrace.supportHtml = true;

                for (const line of outputData.attributes.trace.split(/\r?\n/)) {
                    this.processStackTrace(line, markdownTrace, undefined, this.currentItem, this.projectName);
                }

                const testMessage: TestMessage = new TestMessage(markdownTrace);
                if (this.testMessageLocation) {
                    testMessage.location = this.testMessageLocation;
                    this.testMessageLocation = undefined;
                } else if (item.uri && item.range) {
                    testMessage.location = new Location(item.uri, item.range);
                }
                testMessages.push(testMessage);
            }
            const duration: number = Number.parseInt(outputData.attributes.duration, 10);
            setTestState(this.testContext.testRun, item, this.currentTestState, testMessages, duration);
        } else if (outputData.name === TEST_FINISH) {
            const item: TestItem | undefined = this.getTestItem(data);
            if (!item) {
                return;
            }
            if (this.currentTestState === TestResultState.Running) {
                this.currentTestState = TestResultState.Passed;
            }
            const duration: number = Number.parseInt(outputData.attributes.duration, 10);
            setTestState(this.testContext.testRun, item, this.currentTestState, undefined, duration);
        }
    }

    protected getTestItem(testId: string): TestItem | undefined {
        if (this.currentItem) {
            return this.currentItem;
        }

        this.currentItem = this.triggeredTestsMapping.get(testId);
        return this.currentItem;
    }

    protected unescape(content: string): string {
        return content.replace(/\\r/gm, '\r')
            .replace(/\\f/gm, '\f')
            .replace(/\\n/gm, '\n')
            .replace(/\\t/gm, '\t')
            .replace(/\\b/gm, '\b')
            .replace(/\\"/gm, '"');
    }

    protected initializeCache(): void {
        this.currentTestState = TestResultState.Queued;
        this.currentItem = undefined;
    }
}

interface ITestNGOutputData {
    attributes: ITestNGAttributes;
    type: TestOutputType;
    name: string;
}

enum TestOutputType {
    Info,
    Error,
}

interface ITestNGAttributes {
    name: string;
    duration: string;
    location: string;
    message: string;
    trace: string;
}
