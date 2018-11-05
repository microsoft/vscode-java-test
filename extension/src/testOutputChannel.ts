// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Disposable, OutputChannel, window } from 'vscode';

class TestOutputChannel implements Disposable {
    private readonly channel: OutputChannel = window.createOutputChannel('Java Test Runner');

    public info(info: string): void {
        this.appendLine(`[INFO] ${info}`);
    }

    public error(message: string, error?: Error): void {
        this.appendLine(`[ERROR] ${message}.${error ? ' ' + error : ''}`);
    }

    public show(): void {
        this.channel.show();
    }

    public dispose(): void {
        this.channel.dispose();
    }

    protected appendLine(message: string): void {
        this.channel.appendLine(message);
    }
}

export const testOutputChannel: TestOutputChannel = new TestOutputChannel();
