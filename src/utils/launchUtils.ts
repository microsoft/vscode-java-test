// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as iconv from 'iconv-lite';
import { DebugConfiguration, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { TestTreeNode } from '../explorer/TestTreeNode';
import { logger } from '../logger/logger';
import { ITestItem, TestLevel } from '../protocols';
import { IExecutionConfig } from '../runConfigs';
import { IJUnitLaunchArguments } from '../runners/junit4Runner/Junit4Runner';
import { resolveJUnitLaunchArguments } from './commandUtils';

export async function getDebugConfigurationForEclispeRunner(test: ITestItem, socketPort: number, isDebug: boolean, config?: IExecutionConfig, node?: TestTreeNode): Promise<DebugConfiguration> {
    const junitLaunchArgs: IJUnitLaunchArguments = await getJUnitLaunchArguments(test, node);
    junitLaunchArgs.programArguments.push('-port', `${socketPort}`);
    if (config && config.vmargs) {
        junitLaunchArgs.vmArguments.push(...config.vmargs.filter(Boolean));
    }
    let env: {} = process.env;
    if (config && config.env) {
        env = { ...process.env, ...config.env };
    }

    return {
        name: 'Launch Java Tests',
        type: 'java',
        request: 'launch',
        mainClass: junitLaunchArgs.mainClass,
        projectName: junitLaunchArgs.projectName,
        cwd: config ? config.workingDirectory : undefined,
        classPaths: junitLaunchArgs.classpath,
        modulePaths: junitLaunchArgs.modulepath,
        args: junitLaunchArgs.programArguments,
        vmArgs: junitLaunchArgs.vmArguments,
        encoding: getJavaEncoding(Uri.parse(test.location.uri)),
        env,
        console: 'internalConsole',
        noDebug: !isDebug ? true : false,
    };
}

async function getJUnitLaunchArguments(test: ITestItem, node?: TestTreeNode): Promise<IJUnitLaunchArguments> {
    let className: string = '';
    let methodName: string = '';
    let runFromRoot: boolean = false;
    let uri: string = '';
    let fullName: string = '';

    if (!node) {
        // From Code Lens
        uri = test.location.uri;
        fullName = test.fullName;
    } else {
        // From Test Explorer
        if (node.level === TestLevel.Root) {
            runFromRoot = true;
            uri = workspace.getWorkspaceFolder(Uri.parse(test.location.uri))!.uri.toString();
        } else {
            uri = Uri.file(node.fsPath).toString();
            fullName = node.fullName;
        }
    }

    const nameArray: string[] = fullName.split('#');
    className = nameArray[0];
    if (nameArray.length > 1) {
        methodName = nameArray[1];
    }

    return await resolveJUnitLaunchArguments(uri, className, methodName, runFromRoot);
}

export function getJavaEncoding(uri: Uri, config?: IExecutionConfig): string {
    const encoding: string = getEncodingFromTestConfig(config) || getEncodingFromSetting(uri);
    if (!iconv.encodingExists(encoding)) {
        logger.error(`Unsupported encoding: ${encoding}, fallback to UTF-8.`);
        return 'utf8';
    }
    return encoding;
}

function getEncodingFromTestConfig(config?: IExecutionConfig): string | undefined {
    if (config && config.vmargs) {
        const vmArgsString: string = config.vmargs.join(' ');
        const encodingKey: string = '-Dfile.encoding=';
        const index: number = vmArgsString.lastIndexOf(encodingKey);
        if (index > -1) {
            // loop backwards since the latter vmarg will override the previous one
            return vmArgsString.slice(index + encodingKey.length).split(' ')[0];
        }
    }
    return undefined;
}

function getEncodingFromSetting(uri: Uri): string {
    let javaEncoding: string | null = null;
    // One runner will contain all tests in one workspace with the same test framework.
    const config: WorkspaceConfiguration = workspace.getConfiguration(undefined, uri);
    const languageConfig: {} | undefined = config.get('[java]');
    if (languageConfig != null) {
        javaEncoding = languageConfig['files.encoding'];
    }

    if (javaEncoding == null) {
        javaEncoding = config.get<string>('files.encoding', 'UTF-8');
    }
    return javaEncoding;
}
