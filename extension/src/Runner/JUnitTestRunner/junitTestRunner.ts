// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as glob from 'glob';
import * as path from 'path';
import { IJarFileTestRunnerParameters } from '../JarFileRunner/jarFileRunnerParameters';
import { JarFileRunnerResultAnalyzer } from '../JarFileRunner/jarFileRunnerResultAnalyzer';
import { JarFileTestRunner } from '../JarFileRunner/jarFileTestRunner';
import { JUnitRunnerResultAnalyzer } from './junitRunnerResultAnalyzer';

export class JUnitTestRunner extends JarFileTestRunner {
    public get debugConfigName(): string {
        return 'Debug Junit Test';
    }

    public get runnerJarFilePath(): string {
        const serverHome: string = path.resolve(__dirname, '../../../../server');
        const launchersFound: string[] = glob.sync('**/com.microsoft.java.test.runner-*.jar', { cwd: serverHome });
        if (launchersFound.length) {
            return path.resolve(serverHome, launchersFound[0]);
        } else {
            return null;
        }
    }

    public get runnerClassName(): string {
        return 'com.microsoft.java.test.runner.JUnitLauncher';
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
        const suites: string[] = params.tests.map((t) => t.test);
        commandParams = [...commandParams, ...suites];
        return commandParams.join(' ');
    }

    public getTestResultAnalyzer(params: IJarFileTestRunnerParameters): JarFileRunnerResultAnalyzer {
        return new JUnitRunnerResultAnalyzer(params.tests);
    }
}
