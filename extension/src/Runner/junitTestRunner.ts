// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { JarFileTestRunner } from "./jarFileTestRunner";
import { ITestRunnerContext } from "./testRunnerContext";

import * as glob from 'glob';
import * as path from 'path';

export class JUnitTestRunner extends JarFileTestRunner {
    public get debugConfigName(): string {
        return 'Debug Junit Test';
    }

    public get runnerJarFilePath(): string {
        const serverHome: string = path.resolve(__dirname, '../../../server');
        const launchersFound: string[] = glob.sync('**/com.microsoft.java.test.runner-*.jar', { cwd: serverHome });
        if (launchersFound.length) {
            return path.resolve(serverHome, launchersFound[0]);
        } else {
            return null;
        }
    }

    public async parseParams(context: ITestRunnerContext): Promise<string[]> {
        let params = [];
        params.push('"' + path.resolve(this._javaHome + '/bin/java') + '"');
        params.push('-cp');
        const classpathStr: string = context.contextData.get('classpathStr') as string;
        params.push('"' + classpathStr + '"');

        if (context.isDebugMode) {
            const debugParams = [];
            debugParams.push('-Xdebug');
            const port: number = context.contextData.get('port') as number;
            debugParams.push('-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=' + port);
            params = [...params, ...debugParams];
        }

        params.push('com.microsoft.java.test.runner.JUnitLauncher');
        const suites: string[] = context.tests.map((t) => t.test);
        params = [...params, ...suites];
        return params;
    }
}
