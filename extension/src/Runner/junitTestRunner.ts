// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as glob from 'glob';
import * as path from 'path';
import { TestResultAnalyzer } from "../testResultAnalyzer";
import { JarFileTestRunner } from "./jarFileTestRunner";
import { ITestRunnerEnvironment, JarFileTestRunnerEnvironment } from "./testRunnerEnvironment";

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

    public async parseParams(env: JarFileTestRunnerEnvironment): Promise<string[]> {
        let params = [];
        params.push('"' + path.resolve(this._javaHome + '/bin/java') + '"');
        params.push('-cp');
        const classpathStr: string = env.classpathStr;
        params.push('"' + classpathStr + '"');

        if (env.isDebugMode) {
            const debugParams = [];
            debugParams.push('-Xdebug');
            const port: number = env.port;
            debugParams.push('-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=' + port);
            params = [...params, ...debugParams];
        }

        params.push('com.microsoft.java.test.runner.JUnitLauncher');
        const suites: string[] = env.tests.map((t) => t.test);
        params = [...params, ...suites];
        return params;
    }

    public getTestResultAnalyzer(env: JarFileTestRunnerEnvironment): TestResultAnalyzer {
        return new TestResultAnalyzer(env.tests);
    }
}
