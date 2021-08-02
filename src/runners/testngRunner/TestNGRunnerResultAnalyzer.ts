// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, TestItem, TestMessage, TestResultState } from 'vscode';
import { dataCache } from '../../controller/testItemDataCache';
import { IRunTestContext, TestLevel } from '../../types';
import { IRunnerResultAnalyzer } from '../baseRunner/IRunnerResultAnalyzer';
import { setTestState } from '../utils';

const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class TestNGRunnerResultAnalyzer implements IRunnerResultAnalyzer {

    private readonly regex: RegExp = /@@<TestRunner-({[\s\S]*?})-TestRunner>/;

    private triggeredTestsMapping: Map<string, TestItem> = new Map();
    private currentTestState: TestResultState;
    private currentItem: TestItem | undefined;
    private projectName: string;

    constructor(private testContext: IRunTestContext) {
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
        const lines: string[] = data.split(/\r?\n/);
        for (const line of lines) {
            if (!line) {
                continue;
            }
            const match: RegExpExecArray | null = this.regex.exec(line);
            if (match) {
                // Message from Test Runner executable
                try {
                    this.processData(match[1]);
                } catch (error) {
                    this.testContext.testRun.appendOutput(`[ERROR] Failed to parse output data: ${line}\n`);
                }
            } else {
                this.testContext.testRun.appendOutput(line + '\r\n');
            }
        }
    }

    public processData(data: string): void {
        const outputData: ITestNGOutputData = JSON.parse(data) as ITestNGOutputData;
        if (outputData.name.toLocaleLowerCase() === 'error') {
            this.testContext.testRun.appendOutput(`[ERROR] ${this.unescape(data)}\r\n`);
        } else {
            this.testContext.testRun.appendOutput(`${this.unescape(data)}\r\n`);
        }

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
            if (outputData.attributes.message) {
                const message: TestMessage = new TestMessage(outputData.attributes.message);
                if (item.uri && item.range) {
                    message.location = new Location(item.uri, item.range);
                }
                setTestState(this.testContext.testRun, item, this.currentTestState, message);
            }

            if (outputData.attributes.trace) {
                const trace: TestMessage = new TestMessage(outputData.attributes.trace);
                if (item.uri && item.range) {
                    trace.location = new Location(item.uri, item.range);
                }
                setTestState(this.testContext.testRun, item, this.currentTestState, trace);
            }

            const duration: number = Number.parseInt(outputData.attributes.duration, 10);
            setTestState(this.testContext.testRun, item, this.currentTestState, undefined, duration);
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

interface ITestNGAttributes  {
    name: string;
    duration: string;
    location: string;
    message: string;
    trace: string;
}
