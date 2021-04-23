// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { getTestSourcePaths } from '../utils/commandUtils';

class TestSourcePathProvider {
    /**
     * Test source paths which contains all the source paths from a general project(eclipse & unmanaged-folder)
     * even it does not have 'test' attribute.
     */
    private testSource: string[];
    /**
     * Test source paths of which the classpath entry have 'test' attribute.
     */
    private strictTestSource: string[];

    public async initialize(): Promise<void> {
        this.testSource = [];
        this.strictTestSource = [];
        if (!workspace.workspaceFolders) {
            return;
        }

        this.testSource = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()), true);
        this.strictTestSource = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()), false);
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
        if (this.testSource === undefined || this.strictTestSource === undefined) {
            await this.initialize();
        }

        if (containsGeneral) {
            return this.testSource;
        }

        return this.strictTestSource;
    }
}

export const testSourceProvider: TestSourcePathProvider = new TestSourcePathProvider();
