// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { getTestSourcePaths } from '../utils/commandUtils';

class TestSourcePathProvider {
    private testSource: ITestSourcePath[];

    public async initialize(): Promise<void> {
        this.testSource = [];
        if (!workspace.workspaceFolders) {
            return;
        }

        this.testSource = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
    }

    public async getTestSourcePattern(containsGeneral: boolean = true): Promise<RelativePattern[]> {
        const patterns: RelativePattern[] = [];
        const sourcePaths: string[] = await testSourceProvider.getTestSourcePath(containsGeneral);
        for (const sourcePath of sourcePaths) {
            const normalizedPath: string = Uri.file(sourcePath).fsPath;
            const pattern: RelativePattern = new RelativePattern(normalizedPath, '**/*.java');
            patterns.push(pattern);
        }
        return patterns;
    }

    public async getTestSourcePath(containsGeneral: boolean = true): Promise<string[]> {
        if (this.testSource === undefined) {
            await this.initialize();
        }

        if (containsGeneral) {
            return this.testSource.map((s: ITestSourcePath) => s.testSourcePath);
        }

        return this.testSource.filter((s: ITestSourcePath) => s.isStrict)
            .map((s: ITestSourcePath) => s.testSourcePath);
    }
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
