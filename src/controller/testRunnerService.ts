// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestRunProfileKind } from 'vscode';
import { creatTestProfile } from './testController';
import { TestRunner } from '../java-test-runner.api';

// TODO: this should be refactored. The test controller should be extended and hosting the registered runners.
class TestRunnerService {

    private registeredRunners: Map<string, TestRunner>;

    constructor() {
        this.registeredRunners = new Map<string, TestRunner>();
    }

    public registerTestRunner(name: string, kind: TestRunProfileKind, runner: TestRunner) {
        const key: string = `${name}:${kind}`;
        if (this.registeredRunners.has(key)) {
            throw new Error(`Runner ${key} has already been registered.`);
        }
        creatTestProfile(name, kind);
        this.registeredRunners.set(key, runner);
    }

    public getRunner(name: string | undefined, kind: TestRunProfileKind | undefined): TestRunner | undefined {
        if (!name || !kind) {
            return undefined;
        }
        const key: string = `${name}:${kind}`;
        return this.registeredRunners.get(key);
    }
}

export const testRunnerService: TestRunnerService = new TestRunnerService();
