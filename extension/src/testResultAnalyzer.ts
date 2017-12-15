// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestResult, TestStatus, TestSuite  } from "./protocols";

const SUITE_START: string = 'testSuiteStarted';
const SUITE_FINISH: string = 'testSuiteFinished';
const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class TestResultAnalyzer {

    private _testResults = new Map<string, TestResult>();
    private _suiteName: string;

    constructor(private _testSuites: TestSuite[]) {
    }

    public sendData(data: string): void {
        const regex = /@@<([^@]*)>/gm;
        let match;
        do {
            match = regex.exec(data);
            if (match) {
                this.sendDataCore(match[1]);
            }
        } while (match);
    }

    public feedBack(): void {
        const toAggregate = new Set();
        this._testSuites.forEach((t) => {
            if (t.level === TestLevel.Class) {
                toAggregate.add(t);
                t.children.forEach((c) => this.processMethod(c));
            } else {
                toAggregate.add(t.parent);
                this.processMethod(t);
            }
        });
        toAggregate.forEach((t) => this.processClass(t));
    }

    private sendDataCore(match: string) {
        let res;
        const info = JSON.parse(match) as TestResultInfo;
        switch (info.name) {
            case SUITE_START :
                this._suiteName = info.attributes.name;
                break;
            case SUITE_FINISH:
                this._suiteName = undefined;
                break;
            case TEST_START:
                this._testResults.set(this._suiteName + "#" + info.attributes.name, {
                    status: undefined,
                });
                break;
            case TEST_FAIL:
                res = this._testResults.get(this._suiteName + "#" + info.attributes.name);
                if (!res) {
                    return;
                }
                res.status = TestStatus.Fail;
                res.message = info.attributes.message;
                res.details = info.attributes.details;
                break;
            case TEST_FINISH:
                res = this._testResults.get(this._suiteName + "#" + info.attributes.name);
                if (!res) {
                    return;
                }
                if (!res.status) {
                    res.status = TestStatus.Pass;
                }
                res.duration = info.attributes.duration;
                break;
        }
    }

    private processClass(t: TestSuite): void {
        let passNum: number = 0;
        let failNum: number = 0;
        let skipNum: number = 0;
        let duration: number = 0;
        let notRun: boolean = false;
        for (const child of t.children) {
            if (!child.result) {
                notRun = true;
                continue;
            }
            duration += Number(child.result.duration);
            switch (child.result.status) {
                case TestStatus.Pass:
                    passNum++;
                    break;
                case TestStatus.Fail:
                    failNum++;
                    break;
                case TestStatus.Skipped:
                    skipNum++;
                    break;
            }
        }

        t.result = {
            status: notRun ? undefined : (skipNum === t.children.length ? TestStatus.Skipped : (failNum > 0 ? TestStatus.Fail : TestStatus.Pass)),
            summary: `Tests run: ${passNum + failNum}, Failures: ${failNum}, Skipped: ${skipNum}.`,
            duration: notRun ? undefined : duration.toString(),
        };
    }

    private processMethod(t: TestSuite): void {
        if (!this._testResults.has(t.test)) {
            t.result = {
                status: TestStatus.Skipped,
            };
        } else {
            t.result = this._testResults.get(t.test);
        }
    }
}

export type TestResultInfo = {
    name: string;
    attributes: TestAttributes;
};

export type TestAttributes = {
    name: string;
    duration: string;
    location: string;
    message: string;
    details: string;
};
