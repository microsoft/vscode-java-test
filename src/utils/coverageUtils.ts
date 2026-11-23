// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration, Uri } from 'vscode';
import { extensionContext } from '../extension';
import { randomUUID } from 'crypto';
import * as fse from 'fs-extra';
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

/**
 * The execution data directory used when a run is handed to a delegated runner.
 *
 * Delegated data is kept outside {@link getJacocoReportBasePath} so the built-in
 * and the delegated runner can never merge each other's execution data, and it
 * is kept outside the per-project directories because one delegated run can
 * cover several projects at once.
 */
export function getDelegatedExecutionDataRoot(): string {
    return path.join(extensionContext.storageUri!.fsPath, 'coverage-delegate');
}

/**
 * An execution data directory survives its run so that a later run with the
 * default `appendResult` can still merge it. This bounds how long that lasts;
 * anything older than this cannot belong to a live run.
 */
const DELEGATED_EXECUTION_DATA_RETENTION_MS: number = 24 * 60 * 60 * 1000;

/**
 * Creates the directory that carries one test run's JaCoCo execution data.
 *
 * The directory is unique per test run and shared by every project and batch in
 * it, so that a run which fans out over several projects, tasks or retries
 * still yields a single set of data to analyze. The delegated runner only ever
 * writes into it; creation, retention and removal stay here.
 */
export async function createDelegatedExecutionDataDirectory(): Promise<Uri> {
    const root: string = getDelegatedExecutionDataRoot();
    await pruneDelegatedExecutionData(root);
    const directory: string = path.join(root, randomUUID());
    await fse.ensureDir(directory);
    return Uri.file(directory);
}

/**
 * Drops execution data left behind by runs that are long over, so that keeping
 * data for `appendResult` does not grow without bound. A directory younger than
 * the retention window is never touched, because a concurrent run may still be
 * writing into it.
 */
async function pruneDelegatedExecutionData(root: string): Promise<void> {
    let entries: string[];
    try {
        entries = await fse.readdir(root);
    } catch {
        return;
    }
    const deadline: number = Date.now() - DELEGATED_EXECUTION_DATA_RETENTION_MS;
    await Promise.all(entries.map(async (entry: string) => {
        const candidate: string = path.join(root, entry);
        try {
            const stats: fse.Stats = await fse.stat(candidate);
            if (stats.mtimeMs < deadline) {
                await fse.remove(candidate);
            }
        } catch {
            // Raced with another run removing the same directory; nothing to do.
        }
    }));
}

/**
 * The JaCoCo agent handed to a delegated runner.
 *
 * This is the agent shipped with this extension, which is the only one
 * guaranteed to match the version of the analyzer in the language server. A
 * runner attaching an agent of its own can silently produce execution data with
 * class ids the analyzer will not recognize.
 */
export function getJacocoAgentJarUri(): Uri {
    return Uri.file(extensionContext.asAbsolutePath('server/jacocoagent.jar'));
}

export function getJacocoDataFilePath(projectName: string): string {
    return path.join(getJacocoReportBasePath(projectName), 'jacoco.exec');
}
