// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration } from 'vscode';
import { extensionContext } from '../extension';
import * as path from 'path';

const jacocoAgentRegex: RegExp = /org\.jacoco\.agent-\d+\.\d+\.\d+-runtime\.jar$/;

export function getJacocoAgentPath(debugConfiguration: DebugConfiguration): string {
    if (debugConfiguration.classPaths) {
        for (const classPath of debugConfiguration.classPaths) {
            if (jacocoAgentRegex.test(classPath)) {
                return classPath;
            }
        }
    }

    if (debugConfiguration.modulePaths) {
        for (const modulePath of debugConfiguration.modulePaths) {
            if (jacocoAgentRegex.test(modulePath)) {
                return modulePath;
            }
        }
    }

    return extensionContext.asAbsolutePath('server/jacocoagent.jar');
}

export function getJacocoReportBasePath(projectName: string): string {
    return path.join(extensionContext.storageUri!.fsPath, projectName, 'coverage');
}

export function getJacocoDataFilePath(projectName: string): string {
    return path.join(getJacocoReportBasePath(projectName), 'jacoco.exec');
}
