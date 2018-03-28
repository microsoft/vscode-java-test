// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as glob from 'glob';
import * as path from 'path';

import { TestLevel } from '../../Models/protocols';
import { IJarFileTestRunnerParameters } from '../JarFileRunner/jarFileRunnerParameters';
import { JarFileRunnerResultAnalyzer } from '../JarFileRunner/jarFileRunnerResultAnalyzer';
import { JarFileTestRunner } from '../JarFileRunner/jarFileTestRunner';
import { JUnit5RunnerResultAnalyzer } from './junit5RunnerResultAnalyzer';

export class JUnit5TestRunner extends JarFileTestRunner {
    public get debugConfigName(): string {
        return 'Debug Junit5 Test';
    }

    public get runnerJarFilePath(): string {
        const serverHome: string = path.resolve(__dirname, '../../../../server');
        const launchersFound: string[] = glob.sync('**/com.microsoft.java.test.runner.junit5-*-jar-with-dependencies.jar', { cwd: serverHome });
        if (launchersFound.length) {
            return path.resolve(serverHome, launchersFound[0]);
        } else {
            return null;
        }
    }

    public get runnerClassName(): string {
        return 'com.microsoft.java.test.runner.junit5.CustomizedConsoleLauncher';
    }

    public async constructCommand(params: IJarFileTestRunnerParameters): Promise<string> {
        let commandParams = [];
        commandParams.push('"' + path.resolve(this._javaHome + '/bin/java') + '"');
        commandParams.push('-cp');
        const classpathStr: string = params.classpathStr;
        commandParams.push('"' + classpathStr + '"');

        if (params.isDebugMode) {
            const debugParams = [];
            debugParams.push('-Xdebug');
            const port: number = params.port;
            debugParams.push('-Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=' + port);
            commandParams = [...commandParams, ...debugParams];
        }

        if (params.config) {
            if (params.config.vmargs.length > 0) {
                commandParams = [...commandParams, ...params.config.vmargs];
            }
            if (params.config.args.length > 0) {
                commandParams = [...commandParams, ...params.config.args];
            }
        }
        commandParams.push(this.runnerClassName);

        const suites: string[] = params.tests.map((t) => t.level === TestLevel.Method ? `-m ${t.test}` : `-c ${t.test}`);
        commandParams = [...commandParams, ...suites];
        return commandParams.join(' ');
    }

    public getTestResultAnalyzer(params: IJarFileTestRunnerParameters): JarFileRunnerResultAnalyzer {
        return new JUnit5RunnerResultAnalyzer(params.tests);
    }
}
