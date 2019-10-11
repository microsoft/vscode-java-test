// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { debug, DebugConfiguration, DebugSession, Disposable, Uri, workspace } from 'vscode';
import { logger } from '../../logger/logger';
import { BaseRunner } from '../baseRunner/BaseRunner';
import { BaseRunnerResultAnalyzer } from '../baseRunner/BaseRunnerResultAnalyzer';
import { JUnitRunnerResultAnalyzer } from '../baseRunner/JUnitRunnerResultAnalyzer';

export class JUnit5Runner extends BaseRunner {

    private debugSession: DebugSession | undefined;
    private disposables: Disposable[] = [];

    public async tearDown(isCancel: boolean): Promise<void> {
        super.tearDown(isCancel);
        if (this.debugSession) {
            this.debugSession.customRequest('disconnect');
            this.debugSession = undefined;
        }
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    protected get testResultAnalyzer(): BaseRunnerResultAnalyzer {
        if (!this.runnerResultAnalyzer) {
            this.runnerResultAnalyzer = new JUnitRunnerResultAnalyzer(this.tests);
        }
        return this.runnerResultAnalyzer;
    }

    protected async launchTests(launchConfiguration: DebugConfiguration): Promise<void> {
        if (launchConfiguration.args) {
            (launchConfiguration.args as string[]).push('-port', `${this.server.address().port}`);
        }

        // TODO: why
        if (launchConfiguration.classPaths) {
            (launchConfiguration.classPaths as string[]).push(path.join(this.extensionPath, 'server', 'org.junit.platform.launcher_1.4.0.v20190212-2109.jar'));
        }

        const uri: Uri = Uri.parse(this.tests[0].location.uri);
        logger.verbose(`Launching with the following launch configuration: '${JSON.stringify(launchConfiguration, null, 2)}'\n`);
        debug.startDebugging(workspace.getWorkspaceFolder(uri), launchConfiguration);
        this.disposables.push(debug.onDidStartDebugSession((session: DebugSession) => {
            if (launchConfiguration.name === session.name) {
                this.debugSession = session;
            }
        }));
    }
}
