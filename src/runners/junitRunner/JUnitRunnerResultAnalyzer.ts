// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, TestItem, TestMessage } from 'vscode';
import { dataCache, ITestItemData } from '../../controller/testItemDataCache';
import { createTestItem, updateOrCreateTestItem } from '../../controller/utils';
import { IJavaTestItem } from '../../types';
import { RunnerResultAnalyzer } from '../baseRunner/RunnerResultAnalyzer';
import { findTestLocation, setTestState } from '../utils';
import { JUnitTestPart } from '../../constants';
import { IRunTestContext, TestKind, TestLevel, TestResultState } from '../../java-test-runner.api';


export class JUnitRunnerResultAnalyzer extends RunnerResultAnalyzer {

    private testOutputMapping: Map<string, ITestInfo> = new Map();
    private triggeredTestsMapping: Map<string, TestItem> = new Map();
    private projectName: string;
    private incompleteTestSuite: ITestInfo[] = [];

    // tests may be run concurrently, so each item's current state needs to be remembered
    private currentStates: Map<TestItem, CurrentItemState> = new Map();

    // failure info for a test is received consecutively:
    private tracingItem: TestItem | undefined;
    private traces: MarkdownString;
    private assertionFailure: TestMessage | undefined;
    private recordingType: RecordingType;
    private expectString: string;
    private actualString: string;

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
            this.processData(line);
            this.testContext.testRun.appendOutput(line + '\r\n');
        }
    }

    public processData(data: string): void {
        if (data.startsWith(MessageId.TestTree)) {
            this.enlistToTestMapping(data.substring(MessageId.TestTree.length).trim());
        } else if (data.startsWith(MessageId.TestStart)) {
            const item: TestItem | undefined = this.getTestItem(data.substr(MessageId.TestStart.length));
            if (!item) {
                return;
            }
            this.setCurrentState(item, TestResultState.Running, 0);
            this.setDurationAtStart(this.getCurrentState(item));
            setTestState(this.testContext.testRun, item, this.getCurrentState(item).resultState, undefined, undefined, this.reportGenerator);
        } else if (data.startsWith(MessageId.TestEnd)) {
            const item: TestItem | undefined = this.getTestItem(data.substr(MessageId.TestEnd.length));
            if (!item) {
                return;
            }
            const currentState: CurrentItemState = this.getCurrentState(item);
            this.calcDurationAtEnd(currentState);
            this.determineResultStateAtEnd(data, currentState);
            setTestState(this.testContext.testRun, item, currentState.resultState, undefined, currentState.duration, this.reportGenerator);
        } else if (data.startsWith(MessageId.TestFailed)) {
            const item: TestItem | undefined = this.getTestItem(data.substr(MessageId.TestFailed.length));
            if (!item) {
                return;
            }
            const currentState: CurrentItemState = this.getCurrentState(item);
            this.determineResultStateOnFailure(data, currentState);
            this.initializeTracingItemProcessingCache(item); // traces or comparison failure info might follow immediately
        } else if (data.startsWith(MessageId.TestError)) {
            let item: TestItem | undefined = this.getTestItem(data.substr(MessageId.TestError.length));
            if (!item) {
                if (this.testContext.testItems.length === 1) {
                    item = this.testContext.testItems[0];
                } else {
                    // todo: Report error when we cannot find the target test item?
                    return;
                }
            }
            this.getCurrentState(item).resultState = TestResultState.Errored;
            if (item.id !== this.tracingItem?.id) {
                this.initializeTracingItemProcessingCache(item);
            }
        } else if (data.startsWith(MessageId.TraceStart)) {
            this.traces = new MarkdownString();
            this.traces.isTrusted = true;
            this.traces.supportHtml = true;
            this.recordingType = RecordingType.StackTrace;
        } else if (data.startsWith(MessageId.TraceEnd)) {
            if (!this.tracingItem) {
                return;
            }
            const currentResultState: TestResultState = this.getCurrentState(this.tracingItem).resultState;
            if (this.assertionFailure) {
                this.tryAppendMessage(this.tracingItem, this.assertionFailure, currentResultState);
            }
            if (this.traces?.value) {
                this.tryAppendMessage(this.tracingItem, new TestMessage(this.traces), currentResultState);
            }
            if (currentResultState === TestResultState.Errored) {
                const duration = this.getCurrentState(this.tracingItem).duration;
                setTestState(this.testContext.testRun, this.tracingItem, currentResultState, undefined, duration, this.reportGenerator);
            }
            this.recordingType = RecordingType.None;
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
            this.processStackTrace(data, this.traces, this.tracingItem, this.projectName);
        }
    }

    private determineResultStateOnFailure(data: string, currentState: CurrentItemState): void {
        const isSkip: boolean = data.indexOf(MessageId.ASSUMPTION_FAILED_TEST_PREFIX) > -1;
        currentState.resultState = isSkip ? TestResultState.Skipped : TestResultState.Failed;
    }

    private determineResultStateAtEnd(data: string, currentState: CurrentItemState): void {
        const isIgnore: boolean = data.indexOf(MessageId.IGNORE_TEST_PREFIX) > -1;
        if (isIgnore) {
            currentState.resultState = TestResultState.Skipped;
        } else if (currentState.resultState === TestResultState.Running) {
            currentState.resultState = TestResultState.Passed;
        }
    }

    private setDurationAtStart(currentState: CurrentItemState): void {
        const start: number = Date.now();
        if (currentState.duration === 0) {
            currentState.duration = -start;
        } else if (currentState.duration > 0) {
            // Some test cases may executed multiple times (@RepeatedTest), we need to calculate the time for each execution
            currentState.duration -= start;
        }
    }

    private calcDurationAtEnd(currentState: CurrentItemState): void {
        if (currentState.duration < 0) {
            const end: number = Date.now();
            currentState.duration += end;
        }
    }

    protected getTestItem(message: string): TestItem | undefined {
        const index: string = message.substring(0, message.indexOf(',')).trim();
        return this.testOutputMapping.get(index)?.testItem;
    }

    protected getTestId(message: string): string {
        if (message.includes('engine:junit5') || message.includes('engine:junit-jupiter') || message.includes('engine:jqwik')) {
            return this.getTestIdForJunit5Method(message);
        } else {
            return this.getTestIdForNonJunit5Method(message);
        }
    }

    protected getTestIdForJunit5Method(message: string): string {
        // We're expecting something like:
        // [engine:junit5]/[class:com.example.MyTest]/[method:myTest]/[test-template:myTest(String\, int)]
        const parts: string[] = message.split('/');

        let className: string = '';
        let methodName: string = '';
        let InvocationSuffix: string = '';

        if (!parts || parts.length === 0) {
            // The pattern doesn't match what we're expecting, so we'll go ahead and defer to the non JUnit5 method.
            return this.getTestIdForNonJunit5Method(message);
        }

        parts.forEach((part: string) => {
            // Remove the leading and trailing brackets.
            part = part.trim().replace(/\[/g, '').replace(/\]/g, '');

            if (part.startsWith(JUnitTestPart.CLASS)) {
                className = part.substring(JUnitTestPart.CLASS.length);
            } else if (part.startsWith(JUnitTestPart.METHOD)) {
                const rawMethodName: string = part.substring(JUnitTestPart.METHOD.length);
                // If the method name exists then we want to include the '#' qualifier.
                methodName = `#${this.getJUnit5MethodName(rawMethodName)}`;
            } else if (part.startsWith(JUnitTestPart.TEST_FACTORY)) {
                const rawMethodName: string = part.substring(JUnitTestPart.TEST_FACTORY.length);
                // If the method name exists then we want to include the '#' qualifier.
                methodName = `#${this.getJUnit5MethodName(rawMethodName)}`;
            } else if (part.startsWith(JUnitTestPart.NESTED_CLASS)) {
                const nestedClassName: string = part.substring(JUnitTestPart.NESTED_CLASS.length);
                className = `${className}$${nestedClassName}`;
            } else if (part.startsWith(JUnitTestPart.TEST_TEMPLATE)) {
                const rawMethodName: string = part.substring(JUnitTestPart.TEST_TEMPLATE.length)
                    .replace(/\\,/g, ',');
                // If the method name exists then we want to include the '#' qualifier.
                methodName = `#${this.getJUnit5MethodName(rawMethodName)}`;
            } else if (part.startsWith(JUnitTestPart.PROPERTY)) {
                const rawMethodName: string = part.substring(JUnitTestPart.PROPERTY.length)
                    .replace(/\\,/g, ',');
                // If the method name exists then we want to include the '#' qualifier.
                methodName = `#${this.getJUnit5MethodName(rawMethodName)}`;
            } else if (part.startsWith(JUnitTestPart.TEST_TEMPLATE_INVOCATION)) {
                InvocationSuffix += `[${part.substring(JUnitTestPart.TEST_TEMPLATE_INVOCATION.length)}]`;
            } else if (part.startsWith(JUnitTestPart.DYNAMIC_CONTAINER)) {
                InvocationSuffix += `[${part.substring(JUnitTestPart.DYNAMIC_CONTAINER.length)}]`;
            } else if (part.startsWith(JUnitTestPart.DYNAMIC_TEST)) {
                InvocationSuffix += `[${part.substring(JUnitTestPart.DYNAMIC_TEST.length)}]`;
            }
        });

        if (className) {
            return `${this.projectName}@${className}${methodName}${InvocationSuffix}`;
        } else {
            return `${this.projectName}@${message}${InvocationSuffix}`;
        }
    }

    protected getTestIdForNonJunit5Method(message: string): string {
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

    protected getJUnit5MethodName(rawName: string): string {
        // Let's start by grabbing the text between the parentheses.
        let rawParamsString: string = rawName.substring(rawName.indexOf('(') + 1, rawName.indexOf(')'));
        // We're going to replace any '$' characters with '.' characters to simplify the following logic.
        // NOTE: you will get '$' characters in the name if you have a nested class.
        rawParamsString = rawParamsString.replace(/\$/g, '.')
            .replace(/\\,/g, ',')
            .replace(/ /g, '');

        const params: string[] = rawParamsString.split(',');
        let paramString: string = '';
        params.forEach((param: string) => {
            paramString += `${param.substring(param.lastIndexOf('.') + 1)}, `;
        });
        // We want to remove the final comma and space.
        if (paramString.length > 0) {
            paramString = paramString.substring(0, paramString.length - 2);
        }

        const methodName: string = rawName.substring(0, rawName.indexOf('('));
        return `${methodName}(${paramString})`;
    }

    private setCurrentState(testItem: TestItem, resultState: TestResultState, duration: number): void {
        this.currentStates.set(testItem, { resultState, duration });
    }

    private getCurrentState(testItem: TestItem): CurrentItemState {
        if (!this.currentStates.has(testItem)) this.setCurrentState(testItem, TestResultState.Running, 0);
        return this.currentStates.get(testItem)!;
    }

    private initializeTracingItemProcessingCache(item: TestItem): void {
        this.tracingItem = item;
        this.assertionFailure = undefined;
        this.expectString = '';
        this.actualString = '';
        this.recordingType = RecordingType.None;
        this.testMessageLocation = undefined;
    }

    protected getStacktraceFilter(): string[] {
        return [
            'org.eclipse.jdt.internal.junit.runner.',
            'org.eclipse.jdt.internal.junit4.runner.',
            'org.eclipse.jdt.internal.junit5.runner.',
            'org.eclipse.jdt.internal.junit.ui.',
            'junit.framework.TestCase',
            'junit.framework.TestResult',
            'junit.framework.TestResult$1',
            'junit.framework.TestSuite',
            'junit.framework.Assert',
            'org.junit.',
            'java.lang.reflect.Method.invoke',
            'sun.reflect.',
            'jdk.internal.reflect.',
        ];
    }

    private enlistToTestMapping(message: string): void {
        const regExp: RegExp = /([^\\,]|\\\,?)+/gm;
        // See MessageId.TestTree's comment for its format
        const result: RegExpMatchArray | null = message.match(regExp);
        if (result && result.length > 6) {
            const index: string = result[0];
            const testId: string = this.getTestId(result[result.length - 1]);
            const isSuite: boolean = result[2] === 'true';
            const testCount: number = parseInt(result[3], 10);
            const isDynamic: boolean = result[4] === 'true';
            const parentIndex: string = result[5];
            const displayName: string = result[6].replace(/\\,/g, ',');
            const uniqueId: string | undefined = this.testContext.kind === TestKind.JUnit5 ?
                result[8]?.replace(/\\,/g, ',') : undefined;

            let testItem: TestItem | undefined;
            if (isDynamic) {
                const parentInfo: ITestInfo | undefined = this.testOutputMapping.get(parentIndex);
                const parent: TestItem | undefined = parentInfo?.testItem;
                if (parent) {
                    const parentData: ITestItemData | undefined = dataCache.get(parent);
                    if (parentData?.testLevel === TestLevel.Method || parentData?.testLevel === TestLevel.Invocation) {
                        testItem = this.enlistDynamicMethodToTestMapping(testId, parent, parentData, displayName, uniqueId);
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
                            id: testId,
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

                if (testItem) {
                    if (dataCache.get(testItem)?.testKind === TestKind.JUnit5 &&
                        this.getLabelWithoutCodicon(testItem.label) !== displayName) {
                        testItem.description = displayName;
                    } else {
                        testItem.description = '';
                    }
                }
            }

            this.testOutputMapping.set(index, {
                testId,
                testCount,
                testItem,
            });
        }
    }

    // Leaving this public so that it can be mocked when testing.
    public enlistDynamicMethodToTestMapping(testId: string, parent: TestItem, parentData: ITestItemData, displayName: string, uniqueId: string | undefined): TestItem {
        return updateOrCreateTestItem(parent, {
            children: [],
            uri: parent.uri?.toString(),
            range: parent.range,
            jdtHandler: parentData.jdtHandler,
            fullName: parentData.fullName,
            label: this.getTestMethodName(displayName),
            // prefer uniqueId, as it does not change when re-running only a single invocation:
            id: uniqueId ? uniqueId : testId,
            projectName: parentData.projectName,
            testKind: parentData.testKind,
            testLevel: TestLevel.Invocation,
            uniqueId,
            // We will just create a string padded with the character "a" to provide easy sorting.
            sortText: ''.padStart(parent.children.size + 1, 'a')
        });
    }

    private async tryAppendMessage(item: TestItem, testMessage: TestMessage, testState: TestResultState): Promise<void> {
        if (this.testMessageLocation) {
            testMessage.location = this.testMessageLocation;
        } else if (item.uri && item.range) {
            testMessage.location = new Location(item.uri, item.range);
        } else {
            let id: string = item.id;
            if (this.testContext.kind === TestKind.JUnit) {
                // change test[0] -> test
                // to fix: https://github.com/microsoft/vscode-java-test/issues/1296
                const indexOfParameterizedTest: number = id.lastIndexOf('[');
                if (indexOfParameterizedTest > -1) {
                    id = id.substring(0, id.lastIndexOf('['));
                }
            }
            const location: Location | undefined = await findTestLocation(id);
            testMessage.location = location;
        }
        const duration = this.getCurrentState(item).duration;
        setTestState(this.testContext.testRun, item, testState, testMessage, duration, this.reportGenerator);
    }

    // See: org.eclipse.jdt.internal.junit.model.TestCaseElement#getTestMethodName()
    private getTestMethodName(testName: string): string {
        const index: number = testName.lastIndexOf('(');
        if (index > 0) {
            return testName.substring(0, index);
        }
        return testName;
    }

    /**
     * Get the test item label without the codicon prefix.
     */
    private getLabelWithoutCodicon(name: string): string {
        if (name.includes('#')) {
            name = name.substring(name.indexOf('#') + 1);
        }

        const result: RegExpMatchArray | null = name.match(/(?:\$\(.+\) )?(.*)/);
        if (result?.length === 2) {
            return result[1];
        }
        return name;
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

interface CurrentItemState {
    resultState: TestResultState;
    duration: number;
}
