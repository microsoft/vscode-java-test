// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import { AddressInfo } from 'net';
import { BaseRunner } from '../../src/runners/baseRunner/BaseRunner';
import { RunnerResultAnalyzer } from '../../src/runners/baseRunner/RunnerResultAnalyzer';
import { IRunTestContext, TestKind } from '../../src/java-test-runner.api';

class TestableBaseRunner extends BaseRunner {
    protected getAnalyzer(): RunnerResultAnalyzer {
        return {} as RunnerResultAnalyzer;
    }
}

suite('BaseRunner Tests', () => {

    suite('startSocketServer', () => {
        test('server starts and listens on a valid auto-assigned port', async () => {
            const runner = new TestableBaseRunner({
                kind: TestKind.JUnit,
                isDebug: false,
                projectName: 'test-project',
                testItems: [],
                testRun: {} as any,
                workspaceFolder: {} as any,
            } as IRunTestContext);

            await runner.setup();

            try {
                const address = runner.getServerAddress() as AddressInfo;
                assert.ok(address, 'server should have an address');
                assert.ok(address.port > 0, `server port should be > 0, got ${address.port}`);
                assert.strictEqual(address.family, 'IPv4', 'server should be IPv4');
            } finally {
                await runner.tearDown();
            }
        });

        test('getApplicationArgs returns the auto-assigned port as first argument', async () => {
            const runner = new TestableBaseRunner({
                kind: TestKind.JUnit,
                isDebug: false,
                projectName: 'test-project',
                testItems: [],
                testRun: {} as any,
                workspaceFolder: {} as any,
            } as IRunTestContext);

            await runner.setup();

            try {
                const args = runner.getApplicationArgs();
                assert.ok(args.length > 0, 'application args should not be empty');
                const portArg = args[0];
                const port = parseInt(portArg, 10);
                assert.ok(port > 0, `port in args should be > 0, got ${port}`);
            } finally {
                await runner.tearDown();
            }
        });
    });
});
