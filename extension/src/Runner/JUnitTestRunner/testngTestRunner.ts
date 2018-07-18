import * as glob from 'glob';
import * as path from 'path';

import { TestLevel } from '../../Models/protocols';
import { ITestRunner } from '../testRunner';
import { IJarFileTestRunnerParameters } from '../JarFileRunner/jarFileRunnerParameters';
import { JarFileRunnerResultAnalyzer } from '../JarFileRunner/jarFileRunnerResultAnalyzer';
import { JarFileTestRunner } from '../JarFileRunner/jarFileTestRunner';
import { JUnitRunnerResultAnalyzer } from './junitRunnerResultAnalyzer';

export class TestNGTestRunner extends JarFileTestRunner {
    public get debugConfigName(): string {
        return 'Debug Junit5 Test';
    }

    public get runnerJarFilePath(): string {
        const serverHome: string = path.resolve(__dirname, '../../../../server');
        const launchersFound: string[] = glob.sync('**/com.microsoft.java.test.runner.testng-*.jar', { cwd: serverHome });
        if (launchersFound.length) {
            return path.resolve(serverHome, launchersFound[0]);
        } else {
            return null;
        }
    }

    public get runnerClassName(): string {
        return 'com.microsoft.java.test.runner.testng.TestNGLauncher';
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

        const suites: string[] = params.tests.map((t) => t.level === TestLevel.Method ? `METHOD${t.test}:${t.parent.test}` : `CLASS${t.test}`);
        commandParams = [...commandParams, ...suites];
        return commandParams.join(' ');
    }

    public getTestResultAnalyzer(params: IJarFileTestRunnerParameters): JarFileRunnerResultAnalyzer {
        return new JUnitRunnerResultAnalyzer(params.tests);
    }

    public clone(): ITestRunner {
        return new TestNGTestRunner(this._javaHome, this._storagePath, this._classPathManager, this._projectManager, this._onDidChange);
    }
}