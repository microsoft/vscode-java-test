// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, MarkdownString, TestItem } from 'vscode';
import { dataCache, ITestItemData } from '../../controller/testItemDataCache';
import { IRunTestContext, TestLevel, TestResultState } from '../../java-test-runner.api';
import { processStackTraceLine } from '../utils';

export abstract class RunnerResultAnalyzer {
    // Track parent test item states to update them when all children complete
    protected parentStates: Map<TestItem, ParentItemState> = new Map();

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

    /**
     * Initialize parent state tracking for a test item.
     * Counts how many method-level children are being tested.
     */
    protected initializeParentState(item: TestItem, triggeredTestsMapping: Map<string, TestItem>): void {
        const parent: TestItem | undefined = item.parent;
        if (!parent) {
            return;
        }

        const parentData: ITestItemData | undefined = dataCache.get(parent);
        if (!parentData || parentData.testLevel !== TestLevel.Class) {
            return;
        }

        if (!this.parentStates.has(parent)) {
            // Count how many method-level children are being tested (only count triggered tests)
            let childCount: number = 0;
            parent.children.forEach((child: TestItem) => {
                const childData: ITestItemData | undefined = dataCache.get(child);
                if (childData?.testLevel === TestLevel.Method && triggeredTestsMapping.has(child.id)) {
                    childCount++;
                }
            });

            this.parentStates.set(parent, {
                started: false,
                childrenTotal: childCount,
                childrenCompleted: 0,
                hasFailure: false,
            });
        }
    }

    /**
     * Update parent test item when a child test starts.
     * Marks the parent as "started" when the first child starts.
     */
    protected updateParentOnChildStart(item: TestItem): void {
        const parent: TestItem | undefined = item.parent;
        if (!parent) {
            return;
        }

        const parentState: ParentItemState | undefined = this.parentStates.get(parent);
        if (parentState && !parentState.started) {
            parentState.started = true;
            this.testContext.testRun.started(parent);
        }
    }

    /**
     * Update parent test item when a child test completes.
     * Marks the parent as "passed" or "failed" when all children complete.
     */
    protected updateParentOnChildComplete(item: TestItem, childState: TestResultState): void {
        const parent: TestItem | undefined = item.parent;
        if (!parent) {
            return;
        }

        const parentState: ParentItemState | undefined = this.parentStates.get(parent);
        if (!parentState) {
            return;
        }

        // Consider failed or errored tests as failures for the parent
        if (childState === TestResultState.Failed ||
            childState === TestResultState.Errored) {
            parentState.hasFailure = true;
        }

        parentState.childrenCompleted++;

        // Check if all children have completed
        if (parentState.childrenCompleted >= parentState.childrenTotal && parentState.childrenTotal > 0) {
            if (parentState.hasFailure) {
                this.testContext.testRun.failed(parent, []);
            } else {
                this.testContext.testRun.passed(parent);
            }
        }
    }
}

interface ParentItemState {
    started: boolean;
    childrenTotal: number;
    childrenCompleted: number;
    hasFailure: boolean;
}
