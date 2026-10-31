// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as minimatch from 'minimatch';
import { hasMagic } from 'glob';
import { CancellationToken, OutputChannel, RelativePattern, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

class TestSourcePathProvider {
    private testSourceMapping: Map<string, Promise<ITestSourcePath[]>> = new Map();
    private additionalTestSourceMapping: Map<string, Promise<string[]>> = new Map();

    public async getTestSourcePattern(workspaceFolder: WorkspaceFolder, containsGeneral: boolean = true): Promise<RelativePattern[]> {
        const patterns: RelativePattern[] = [];
        const sourcePaths: string[] = await testSourceProvider.getTestSourcePath(workspaceFolder, containsGeneral);
        for (const sourcePath of sourcePaths) {
            const normalizedPath: string = Uri.file(sourcePath).fsPath;
            const pattern: RelativePattern = new RelativePattern(normalizedPath, '**/*.java');
            patterns.push(pattern);
        }
        return patterns;
    }

    public async getTestSourcePath(workspaceFolder: WorkspaceFolder, containsGeneral: boolean = true): Promise<string[]> {
        const testPaths: ITestSourcePath[] = await this.getTestPaths(workspaceFolder);

        if (containsGeneral) {
            return testPaths.map((s: ITestSourcePath) => s.testSourcePath);
        }

        return testPaths.filter((s: ITestSourcePath) => s.isStrict)
            .map((s: ITestSourcePath) => s.testSourcePath);
    }

    public getAdditionalTestSourcePaths(workspaceFolder: WorkspaceFolder, token?: CancellationToken): Promise<string[]> {
        const configuredPaths: string[] = workspace.getConfiguration('java.test', workspaceFolder.uri)
            .get<string[]>('additionalTestSourcePaths', []);
        if (configuredPaths.length === 0) {
            return Promise.resolve([]);
        }
        if (token) {
            if (token.isCancellationRequested) {
                return Promise.resolve([]);
            }
            return getSourcePaths([workspaceFolder.uri.toString()], token).then((sourcePaths: ITestSourcePath[]) =>
                token.isCancellationRequested
                    ? []
                    : resolveAdditionalTestSourcePaths(workspaceFolder.uri.fsPath, configuredPaths,
                        sourcePaths.map((sourcePath: ITestSourcePath) => sourcePath.testSourcePath)));
        }

        const workspaceKey: string = workspaceFolder.uri.toString();
        let resolvedPaths: Promise<string[]> | undefined = this.additionalTestSourceMapping.get(workspaceKey);
        if (!resolvedPaths) {
            resolvedPaths = getSourcePaths([workspaceFolder.uri.toString()]).then((sourcePaths: ITestSourcePath[]) =>
                resolveAdditionalTestSourcePaths(workspaceFolder.uri.fsPath, configuredPaths,
                    sourcePaths.map((sourcePath: ITestSourcePath) => sourcePath.testSourcePath)));
            this.additionalTestSourceMapping.set(workspaceKey, resolvedPaths);
            resolvedPaths.catch(() => {
                if (this.additionalTestSourceMapping.get(workspaceKey) === resolvedPaths) {
                    this.additionalTestSourceMapping.delete(workspaceKey);
                }
            });
        }
        return resolvedPaths;
    }

    public async isOnTestSourcePath(uri: Uri): Promise<boolean> {
        const workspaceFolder: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return false;
        }
        const testPaths: ITestSourcePath[] = await this.getTestPaths(workspaceFolder);
        const fsPath: string = uri.fsPath;
        for (const testPath of testPaths) {
            const relativePath: string = path.relative(testPath.testSourcePath, fsPath);
            if (!relativePath.startsWith('..')) {
                return true;
            }
        }
        return false;
    }

    public clear(): void {
        this.testSourceMapping.clear();
        this.additionalTestSourceMapping.clear();
    }

    public dispose(): void {
        additionalTestSourceOutputChannel?.dispose();
        additionalTestSourceOutputChannel = undefined;
    }

    private async getTestPaths(workspaceFolder: WorkspaceFolder): Promise<ITestSourcePath[]> {
        const workspaceKey: string = workspaceFolder.uri.toString();
        let testPaths: Promise<ITestSourcePath[]> | undefined = this.testSourceMapping.get(workspaceKey);
        if (!testPaths) {
            testPaths = getTestSourcePaths([workspaceFolder.uri.toString()]);
            this.testSourceMapping.set(workspaceKey, testPaths);
            testPaths.catch(() => {
                if (this.testSourceMapping.get(workspaceKey) === testPaths) {
                    this.testSourceMapping.delete(workspaceKey);
                }
            });
        }

        return mergeTestSourcePaths(await testPaths, await this.getAdditionalTestSourcePaths(workspaceFolder));
    }
}

let additionalTestSourceOutputChannel: OutputChannel | undefined;
const LARGE_ADDITIONAL_TEST_SOURCE_COUNT: number = 100;

export function mergeTestSourcePaths(testPaths: ITestSourcePath[], additionalPaths: string[]): ITestSourcePath[] {
    const mergedPaths: ITestSourcePath[] = [];
    const pathIndexes: Map<string, number> = new Map();
    for (const testPath of testPaths) {
        const key: string = getPathKey(testPath.testSourcePath);
        const existingIndex: number | undefined = pathIndexes.get(key);
        if (existingIndex !== undefined) {
            mergedPaths[existingIndex].isStrict ||= testPath.isStrict;
            continue;
        }

        pathIndexes.set(key, mergedPaths.length);
        mergedPaths.push({ ...testPath });
    }

    for (const additionalPath of additionalPaths) {
        const key: string = getPathKey(additionalPath);
        const existingIndex: number | undefined = pathIndexes.get(key);
        if (existingIndex !== undefined) {
            mergedPaths[existingIndex].isStrict = true;
            continue;
        }

        pathIndexes.set(key, mergedPaths.length);
        mergedPaths.push({ testSourcePath: additionalPath, isStrict: true });
    }
    return mergedPaths;
}

export async function resolveAdditionalTestSourcePaths(
    workspacePath: string, configuredPaths: string[], importedSourcePaths: string[]): Promise<string[]> {
    const paths: string[] = [];
    const pathKeys: Set<string> = new Set();
    const sourcePathByKey: Map<string, string> = new Map();
    for (const sourcePath of importedSourcePaths) {
        sourcePathByKey.set(getPathKey(sourcePath), sourcePath);
    }

    for (const configuredPath of configuredPaths) {
        if (!configuredPath.trim()) {
            continue;
        }

        const normalizedPattern: string = configuredPath.trim().replace(/\\/g, '/');
        const resolvedPattern: string = path.resolve(workspacePath, normalizedPattern);
        if (!hasMagic(normalizedPattern)) {
            const sourcePath: string | undefined = sourcePathByKey.get(getPathKey(resolvedPattern));
            if (sourcePath) {
                addUniquePath(paths, pathKeys, sourcePath);
            }
            continue;
        }

        try {
            const matcher: minimatch.Minimatch = new minimatch.Minimatch(
                path.isAbsolute(normalizedPattern)
                    ? normalizedPattern
                    : normalizedPattern.replace(/^\.\//, ''),
                { nocase: process.platform === 'win32' });
            for (const sourcePath of sourcePathByKey.values()) {
                const matchPath: string = path.isAbsolute(normalizedPattern)
                    ? sourcePath.replace(/\\/g, '/')
                    : path.relative(workspacePath, sourcePath).replace(/\\/g, '/');
                if (matchPath !== '..' && !matchPath.startsWith('../') && !path.isAbsolute(matchPath) &&
                        matcher.match(matchPath)) {
                    addUniquePath(paths, pathKeys, sourcePath);
                }
            }
        } catch (error) {
            const message: string = error instanceof Error ? error.message : String(error);
            logAdditionalTestSourceMessage(`Failed to match additional test source pattern "${configuredPath}": ${message}`);
        }
    }

    if (paths.length > LARGE_ADDITIONAL_TEST_SOURCE_COUNT) {
        logAdditionalTestSourceMessage(
            `Additional test source patterns matched ${paths.length} imported source roots. Broad patterns may slow discovery.`);
    }
    return paths;
}

function logAdditionalTestSourceMessage(message: string): void {
    additionalTestSourceOutputChannel ??= window.createOutputChannel('Test Runner for Java');
    additionalTestSourceOutputChannel.appendLine(message);
}

function addUniquePath(paths: string[], pathKeys: Set<string>, sourcePath: string): void {
    const key: string = getPathKey(sourcePath);
    if (!pathKeys.has(key)) {
        paths.push(sourcePath);
        pathKeys.add(key);
    }
}

function getPathKey(sourcePath: string): string {
    const normalizedPath: string = path.normalize(sourcePath);
    return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
}

async function getTestSourcePaths(uri: string[]): Promise<ITestSourcePath[]> {
    return await executeJavaLanguageServerCommand<ITestSourcePath[]>(
        JavaTestRunnerDelegateCommands.GET_TEST_SOURCE_PATH, uri) || [];
}

async function getSourcePaths(uri: string[], token?: CancellationToken): Promise<ITestSourcePath[]> {
    if (token) {
        return await executeJavaLanguageServerCommand<ITestSourcePath[]>(
            JavaTestRunnerDelegateCommands.GET_SOURCE_PATH, uri, token) || [];
    }
    return await executeJavaLanguageServerCommand<ITestSourcePath[]>(
        JavaTestRunnerDelegateCommands.GET_SOURCE_PATH, uri) || [];
}

export interface ITestSourcePath {
    testSourcePath: string;
    /**
     * All the source paths from eclipse and invisible project will be treated as test source
     * even they are not marked as test in the classpath entry, in that case, this field will be false.
     */
    isStrict: boolean;
}

export const testSourceProvider: TestSourcePathProvider = new TestSourcePathProvider();
