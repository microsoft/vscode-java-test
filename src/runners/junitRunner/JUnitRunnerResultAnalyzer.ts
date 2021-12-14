// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, TestItem, TestMessage } from 'vscode';
import { INVOCATION_PREFIX } from '../../constants';
import { dataCache, ITestItemData } from '../../controller/testItemDataCache';
import { createTestItem } from '../../controller/utils';
import { IJavaTestItem, IRunTestContext, TestKind, TestLevel } from '../../types';
import { RunnerResultAnalyzer } from '../baseRunner/RunnerResultAnalyzer';
import { findTestLocation, setTestState, TestResultState } from '../utils';

export class JUnitRunnerResultAnalyzer extends RunnerResultAnalyzer {

    private testOutputMapping: Map<string, ITestInfo> = new Map();
    private triggeredTestsMapping: Map<string, TestItem> = new Map();
    private currentTestState: TestResultState;
    private currentItem: TestItem | undefined;
    private currentDuration: number = 0;
    private traces: MarkdownString;
    private assertionFailure: TestMessage | undefined;
    private recordingType: RecordingType;
    private expectString: string;
    private actualString: string;
    private projectName: string;
    private incompleteTestSuite: ITestInfo[] = [];

    constructor(protected testContext: IRunTestContext) {
        super(testContext);
        this.projectName = testContext.projectName;
        const queue: TestItem[] = [...testContext.testItems];
        while (queue.length) {
            const item: TestItem = queue.shift()!;
            const testLevel: TestLevel | undefined = dataCache.get(item)?.testLevel;
            if (testLevel === undefined || testLevel === TestLevel.Invocation) {
                continue;
            } else if (testLevel === TestLevel.Method && item.parent) {
                this.triggeredTestsMapping.set(item.parent.id, item.parent);
            } else {
                item.children.forEach((child: TestItem) => {
                    queue.push(child);
                });
            }
            this.triggeredTestsMapping.set(item.id, item);
        }
    }

    public analyzeData(data: string): void {
        const lines: string[] = data.split(/\r?\n/);
        for (const line of lines) {
            if (!line) {
                continue;
            }
            this.processData(line);
            this.testContext.testRun.appendOutput(line + '\r\n');
        }
    }

    public processData(data: string): void {
        if (data.startsWith(MessageId.TestTree)) {
            this.enlistToTestMapping(data.substr(MessageId.TestTree.length).trim());
        } else if (data.startsWith(MessageId.TestStart)) {
            const item: TestItem | undefined = this.getTestItem(data.substr(MessageId.TestStart.length));
            if (!item) {
                return;
            }
            if (item.id !== this.currentItem?.id) {
                this.initializeCache(item);
            }
            this.testContext.testRun.started(item);

            const start: number = Date.now();
            if (this.currentDuration === 0) {
                this.currentDuration = -start;
            } else if (this.currentDuration > 0) {
                // Some test cases may executed multiple times (@RepeatedTest), we need to calculate the time for each execution
                this.currentDuration -= start;
            }
        } else if (data.startsWith(MessageId.TestEnd)) {
            if (!this.currentItem) {
                return;
            }

            if (this.currentDuration < 0) {
                const end: number = Date.now();
                this.currentDuration += end;
            }

            if (data.indexOf(MessageId.IGNORE_TEST_PREFIX) > -1) {
                this.currentTestState = TestResultState.Skipped;
            } else if (this.currentTestState === TestResultState.Running) {
                this.currentTestState = TestResultState.Passed;
            }
            setTestState(this.testContext.testRun, this.currentItem, this.currentTestState, undefined, this.currentDuration);
        } else if (data.startsWith(MessageId.TestFailed)) {
            if (data.indexOf(MessageId.ASSUMPTION_FAILED_TEST_PREFIX) > -1) {
                this.currentTestState = TestResultState.Skipped;
            } else {
                this.currentTestState = TestResultState.Failed;
            }
        } else if (data.startsWith(MessageId.TestError)) {
            const item: TestItem | undefined = this.getTestItem(data.substr(MessageId.TestError.length));
            if (!item) {
                return;
            }
            if (item.id !== this.currentItem?.id) {
                this.initializeCache(item);
            }
            this.currentTestState = TestResultState.Errored;
        } else if (data.startsWith(MessageId.TraceStart)) {
            this.traces = new MarkdownString();
            this.traces.isTrusted = true;
            this.traces.supportHtml = true;
            this.recordingType = RecordingType.StackTrace;
        } else if (data.startsWith(MessageId.TraceEnd)) {
            if (!this.currentItem) {
                return;
            }

            const testMessage: TestMessage = new TestMessage(this.traces);
            this.tryAppendMessage(this.currentItem, testMessage, this.currentTestState);
            this.recordingType = RecordingType.None;
            if (this.currentTestState === TestResultState.Errored) {
                setTestState(this.testContext.testRun, this.currentItem, this.currentTestState);
            }
        } else if (data.startsWith(MessageId.ExpectStart)) {
            this.recordingType = RecordingType.ExpectMessage;
        } else if (data.startsWith(MessageId.ExpectEnd)) {
            this.recordingType = RecordingType.None;
            this.expectString = this.expectString.replace(/\n$/, '');
        } else if (data.startsWith(MessageId.ActualStart)) {
            this.recordingType = RecordingType.ActualMessage;
        } else if (data.startsWith(MessageId.ActualEnd)) {
            this.recordingType = RecordingType.None;
            this.actualString = this.actualString.replace(/\n$/, '');
            if (!this.assertionFailure && this.expectString && this.actualString) {
                this.assertionFailure = TestMessage.diff(`Expected [${this.expectString}] but was [${this.actualString}]`, this.expectString, this.actualString);
            }
        } else if (this.recordingType === RecordingType.ExpectMessage) {
            this.expectString += data + '\n';
        } else if (this.recordingType === RecordingType.ActualMessage) {
            this.actualString += data + '\n';
        } else if (this.recordingType === RecordingType.StackTrace) {
            if (!this.assertionFailure) {
                const assertionRegExp: RegExp = /expected.*:.*<(.+?)>.*but.*:.*<(.+?)>/mi;
                const assertionResults: RegExpExecArray | null = assertionRegExp.exec(data);
                if (assertionResults && assertionResults.length === 3) {
                    this.assertionFailure = TestMessage.diff(`Expected [${assertionResults[1]}] but was [${assertionResults[2]}]`, assertionResults[1], assertionResults[2]);
                }
            }

            this.processStackTrace(data, this.traces, this.assertionFailure, this.currentItem, this.projectName);
        }
    }

    protected getTestItem(message: string): TestItem | undefined {
        const index: string = message.substring(0, message.indexOf(',')).trim();
        return this.testOutputMapping.get(index)?.testItem;
    }

    protected getTestId(message: string): string {
        /**
         * The following regex expression is used to parse the test runner's output, which match the following components:
         * '(?:@AssumptionFailure: |@Ignore: )?' - indicate if the case is ignored due to assumption failure or disabled
         * '(.*?)'                               - test method name
         * '\(([^)]*)\)[^(]*$'                   - class fully qualified name which wrapped by the last paired brackets, see:
         *                                         https://github.com/microsoft/vscode-java-test/issues/1075
         */
        const regexp: RegExp = /(?:@AssumptionFailure: |@Ignore: )?(.*?)\(([^)]*)\)[^(]*$/;
        const matchResults: RegExpExecArray | null = regexp.exec(message);
        if (matchResults && matchResults.length === 3) {
            return `${this.projectName}@${matchResults[2]}#${matchResults[1]}`;
        }

        // In case the output is class level, i.e.: `%ERROR 2,a.class.FullyQualifiedName`
        const indexOfSpliter: number = message.lastIndexOf(',');
        if (indexOfSpliter > -1) {
            return `${this.projectName}@${message.slice(indexOfSpliter + 1)}`;
        }

        return `${this.projectName}@${message}`;
    }

    protected initializeCache(item: TestItem): void {
        this.currentTestState = TestResultState.Running;
        this.currentItem = item;
        this.currentDuration = 0;
        this.assertionFailure = undefined;
        this.expectString = '';
        this.actualString = '';
        this.recordingType = RecordingType.None;
    }

    private enlistToTestMapping(message: string): void {
        const regExp: RegExp = /([^\\,]|\\\,?)+/gm;
        // See MessageId.TestTree's comment for its format
        const result: RegExpMatchArray | null = message.match(regExp);
        if (result && result.length > 6) {
            const index: string = result[0];
            const testId: string = this.getTestId(result[1]);
            const isSuite: boolean = result[2] === 'true';
            const testCount: number = parseInt(result[3], 10);
            const isDynamic: boolean = result[4] === 'true';
            const parentIndex: string = result[5];
            const displayName: string = result[6].replace(/\\,/g, ',');

            let testItem: TestItem | undefined;
            if (isDynamic) {
                const parentInfo: ITestInfo | undefined = this.testOutputMapping.get(parentIndex);
                const parent: TestItem | undefined = parentInfo?.testItem;
                if (parent) {
                    const parentData: ITestItemData | undefined = dataCache.get(parent);
                    if (parentData?.testLevel === TestLevel.Method) {
                        testItem = createTestItem({
                            children: [],
                            uri: parent.uri?.toString(),
                            range: parent.range,
                            jdtHandler: parentData.jdtHandler,
                            fullName: parentData.fullName,
                            label: this.getTestMethodName(displayName),
                            id: `${INVOCATION_PREFIX}${parent.id}[#${parent.children.size + 1}]`,
                            projectName: parentData.projectName,
                            testKind: parentData.testKind,
                            testLevel: TestLevel.Invocation,
                        }, parent);
                    }
                }
            } else {
                testItem = this.triggeredTestsMapping.get(testId);

                if (this.incompleteTestSuite.length) {
                    const suiteIdx: number = this.incompleteTestSuite.length - 1;
                    const parentSuite: ITestInfo = this.incompleteTestSuite[suiteIdx];
                    parentSuite.testCount--;
                    if (parentSuite.testCount <= 0) {
                        this.incompleteTestSuite.pop();
                    }
                    if (!testItem && parentSuite.testItem) {
                        const itemData: IJavaTestItem | undefined = {
                            children: [],
                            uri: undefined,
                            range: undefined,
                            jdtHandler: '',
                            fullName: testId.substr(testId.indexOf('@') + 1),
                            label: this.getTestMethodName(displayName),
                            id: `${INVOCATION_PREFIX}${testId}`,
                            projectName: this.projectName,
                            testKind: this.testContext.kind,
                            testLevel: TestLevel.Invocation,
                        };
                        testItem = createTestItem(itemData, parentSuite.testItem);
                    }
                }

                if (isSuite && testCount > 0) {
                    this.incompleteTestSuite.push({
                        testId,
                        testCount,
                        testItem,
                    });
                }

                if (testItem && dataCache.get(testItem)?.testKind === TestKind.JUnit5 && testItem.label !== displayName) {
                    testItem.description = displayName;
                }
            }

            this.testOutputMapping.set(index, {
                testId,
                testCount,
                testItem,
            });
        }
    }

    private async tryAppendMessage(item: TestItem, testMessage: TestMessage, testState: TestResultState): Promise<void> {
        if (this.testMessageLocation) {
            testMessage.location = this.testMessageLocation;
            this.testMessageLocation = undefined;
        } else if (item.uri && item.range) {
            testMessage.location = new Location(item.uri, item.range);
        } else {
            let id: string = item.id;
            if (id.startsWith(INVOCATION_PREFIX)) {
                id = id.substring(INVOCATION_PREFIX.length);
                if (this.testContext.kind === TestKind.JUnit) {
                    // change test[0] -> test
                    // to fix: https://github.com/microsoft/vscode-java-test/issues/1296
                    id = id.substring(0, id.lastIndexOf('['));
                }
            }
            const location: Location | undefined = await findTestLocation(id);
            testMessage.location = location;
        }
        setTestState(this.testContext.testRun, item, testState, testMessage);
    }

    // See: org.eclipse.jdt.internal.junit.model.TestCaseElement#getTestMethodName()
    private getTestMethodName(testName: string): string {
        const index: number = testName.lastIndexOf('(');
        if (index > 0) {
            return testName.substring(0, index);
        }
        return testName;
    }
}

enum MessageId {
    /**
     * Notification about a test inside the test suite.
     * TEST_TREE + testId + "," + testName + "," + isSuite + "," + testCount + "," + isDynamicTest +
     * "," + parentId + "," + displayName + "," + parameterTypes + "," + uniqueId
     * isSuite = "true" or "false"
     * isDynamicTest = "true" or "false"
     * parentId = the unique id of its parent if it is a dynamic test, otherwise can be "-1"
     * displayName = the display name of the test
     * parameterTypes = comma-separated list of method parameter types if applicable, otherwise an
     * empty string
     * uniqueId = the unique ID of the test provided by JUnit launcher, otherwise an empty string
     */
    TestTree = '%TSTTREE',
    TestStart = '%TESTS',
    TestEnd = '%TESTE',
    TestFailed = '%FAILED',
    TestError = '%ERROR',
    ExpectStart = '%EXPECTS',
    ExpectEnd = '%EXPECTE',
    ActualStart = '%ACTUALS',
    ActualEnd = '%ACTUALE',
    TraceStart = '%TRACES',
    TraceEnd = '%TRACEE',
    IGNORE_TEST_PREFIX = '@Ignore: ',
    ASSUMPTION_FAILED_TEST_PREFIX = '@AssumptionFailure: ',
}

interface ITestInfo {
    testId: string;
    testCount: number;
    testItem: TestItem | undefined;
}

enum RecordingType {
    None,
    StackTrace,
    ExpectMessage,
    ActualMessage,
}
