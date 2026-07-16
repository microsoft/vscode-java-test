// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, TestItem, TestMessage } from 'vscode';
import { dataCache } from '../../controller/testItemDataCache';
import { RunnerResultAnalyzer } from '../baseRunner/RunnerResultAnalyzer';
import { setTestState } from '../utils';
import { IRunTestContext, TestLevel, TestResultState } from '../../java-test-runner.api';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';
const TEST_ERROR: string = 'error';

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
                this.testContext.testRun.enqueued(item);
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
                this.testContext.testRun.appendOutput(`[ERROR] Failed to parse output data: ${match[1]}\r\n`);
            }
        }
    }

    public processData(data: string): void {
        const outputData: ITestNGOutputData = JSON.parse(data) as ITestNGOutputData;

        if (outputData.name === TEST_ERROR) {
            this.processRunnerError(outputData.attributes);
            return;
        }

        const attributes: ITestNGAttributes | undefined = outputData.attributes;
        if (!attributes?.name) {
            return;
        }

        const id: string = `${this.projectName}@${attributes.name}`;
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

            if (attributes.trace) {
                const markdownTrace: MarkdownString = new MarkdownString();
                markdownTrace.isTrusted = true;
                markdownTrace.supportHtml = true;
                for (const line of attributes.trace.split(/\r?\n/)) {
                    this.processStackTrace(line, markdownTrace, this.currentItem, this.projectName);
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
            const duration: number | undefined = this.parseDuration(attributes.duration);
            setTestState(this.testContext.testRun, item, this.currentTestState, testMessages, duration);
        } else if (outputData.name === TEST_FINISH) {
            const item: TestItem | undefined = this.getTestItem(id);
            if (!item) {
                return;
            }
            if (this.currentTestState === TestResultState.Running) {
                this.currentTestState = TestResultState.Passed;
            }
            const duration: number | undefined = this.parseDuration(attributes.duration);
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

    protected initializeCache(): void {
        this.currentTestState = TestResultState.Queued;
        this.currentItem = undefined;
    }

    private processRunnerError(attributes: ITestNGAttributes | undefined): void {
        let message: string = attributes?.message || 'Failed to run TestNG tests.';
        if (attributes?.trace) {
            message += `\n${attributes.trace}`;
        }
        const testMessage: TestMessage = new TestMessage(message);
        const testCases: Set<TestItem> = new Set(this.triggeredTestsMapping.values());
        const items: Iterable<TestItem> = testCases.size > 0 ? testCases : this.testContext.testItems;
        for (const item of items) {
            this.testContext.testRun.errored(item, testMessage);
        }
    }

    private parseDuration(duration: string | undefined): number | undefined {
        if (!duration) {
            return undefined;
        }

        const parsed: number = Number.parseInt(duration, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
    }

    protected getStacktraceFilter(): string[] {
        return [
            'com.microsoft.java.test.runner.',
            'org.testng.internal.',
            'org.testng.TestRunner',
            'org.testng.SuiteRunner',
            'org.testng.TestNG',
            'org.testng.Assert',
            'java.lang.reflect.Method.invoke',
            'sun.reflect.',
            'jdk.internal.reflect.',
        ];
    }
}

interface ITestNGOutputData {
    attributes?: ITestNGAttributes;
    name: string;
}

interface ITestNGAttributes {
    name?: string;
    duration?: string;
    location?: string;
    message?: string;
    trace?: string;
}
