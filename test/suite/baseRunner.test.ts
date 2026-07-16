// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { AddressInfo } from 'net';
import { BaseRunner } from '../../src/runners/baseRunner/BaseRunner';
import { RunnerResultAnalyzer } from '../../src/runners/baseRunner/RunnerResultAnalyzer';
import { IRunTestContext, TestKind } from '../../src/java-test-runner.api';

class TestableBaseRunner extends BaseRunner {
    public handleMessage(message: any): void {
        this.handleDebugAdapterMessage(message);
    }

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

    suite('handleDebugAdapterMessage', () => {
        test('forwards non-telemetry output at run level with CRLF newlines', () => {
            const appendOutput = sinon.spy();
            const runner = new TestableBaseRunner({
                kind: TestKind.JUnit,
                isDebug: false,
                projectName: 'test-project',
                testItems: [],
                testRun: { appendOutput } as any,
                workspaceFolder: {} as any,
            } as IRunTestContext);

            runner.handleMessage({
                type: 'event',
                event: 'output',
                body: {
                    category: 'console',
                    output: 'first\nsecond\r\n',
                },
            });

            sinon.assert.calledOnceWithExactly(appendOutput, 'first\r\nsecond\r\n');
        });

        test('ignores telemetry output', () => {
            const appendOutput = sinon.spy();
            const runner = new TestableBaseRunner({
                kind: TestKind.JUnit,
                isDebug: false,
                projectName: 'test-project',
                testItems: [],
                testRun: { appendOutput } as any,
                workspaceFolder: {} as any,
            } as IRunTestContext);

            runner.handleMessage({
                type: 'event',
                event: 'output',
                body: {
                    category: 'telemetry',
                    output: 'internal event',
                },
            });

            sinon.assert.notCalled(appendOutput);
        });
    });
});
