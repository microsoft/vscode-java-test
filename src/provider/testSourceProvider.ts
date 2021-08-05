// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { JavaTestRunnerDelegateCommands } from '../constants';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

class TestSourcePathProvider {
    private testSourceMapping: Map<Uri, ITestSourcePath[]> = new Map();

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
    }

    public delete(workspaceUri: Uri): boolean {
        return this.testSourceMapping.delete(workspaceUri);
    }

    private async getTestPaths(workspaceFolder: WorkspaceFolder): Promise<ITestSourcePath[]> {
        let testPaths: ITestSourcePath[] | undefined = this.testSourceMapping.get(workspaceFolder.uri);
        if (!testPaths) {
            testPaths = await getTestSourcePaths([workspaceFolder.uri.toString()]);
            this.testSourceMapping.set(workspaceFolder.uri, testPaths);
        }
        return testPaths;
    }
}

async function getTestSourcePaths(uri: string[]): Promise<ITestSourcePath[]> {
    return await executeJavaLanguageServerCommand<ITestSourcePath[]>(
        JavaTestRunnerDelegateCommands.GET_TEST_SOURCE_PATH, uri) || [];
}

interface ITestSourcePath {
    testSourcePath: string;
    /**
     * All the source paths from eclipse and invisible project will be treated as test source
     * even they are not marked as test in the classpath entry, in that case, this field will be false.
     */
    isStrict: boolean;
}

export const testSourceProvider: TestSourcePathProvider = new TestSourcePathProvider();
