// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { extensionContext } from '../extension';
import * as path from 'path';

export function getJacocoAgentPath(): string {
    return extensionContext.asAbsolutePath('server/jacocoagent.jar');
}

export function getJacocoReportBasePath(projectName: string): string {
    return path.join(extensionContext.storageUri!.fsPath, projectName, 'coverage');
}

export function getJacocoDataFilePath(projectName: string): string {
    return path.join(getJacocoReportBasePath(projectName), 'jacoco.exec');
}
