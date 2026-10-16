// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { RelativePattern, Uri, WorkspaceConfiguration, WorkspaceFolder, workspace } from 'vscode';
import * as commandUtils from '../../src/utils/commandUtils';
import { ITestSourcePath, mergeTestSourcePaths, resolveAdditionalTestSourcePaths, testSourceProvider } from '../../src/provider/testSourceProvider';

suite('testSourceProvider', () => {
    test('returns no extra paths by default', async () => {
        assert.deepStrictEqual(await resolveAdditionalTestSourcePaths(path.resolve('workspace'), []), []);
    });

    test('resolves multiple relative paths against the workspace folder', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const relativePaths: string[] = [path.join('src', 'main', 'java'), path.join('src', 'integrationTest', 'java')];
        relativePaths.forEach((relativePath: string) => fse.ensureDirSync(path.join(workspacePath, relativePath)));
        try {
            const sourcePaths: string[] = await resolveAdditionalTestSourcePaths(workspacePath, relativePaths);

            assert.deepStrictEqual(sourcePaths, relativePaths.map((relativePath: string) => path.resolve(workspacePath, relativePath)));
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('deduplicates equivalent Windows path spellings', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const relativePath: string = path.join('src', 'main', 'java');
        fse.ensureDirSync(path.resolve(workspacePath, relativePath));
        try {
            const sourcePaths: string[] = await resolveAdditionalTestSourcePaths(workspacePath, [
                relativePath,
                relativePath.replace(/\\/g, '/'),
                path.resolve(workspacePath, relativePath),
            ]);

            assert.deepStrictEqual(sourcePaths, [path.resolve(workspacePath, relativePath)]);
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('merges an additional path already discovered by Java without duplicating it', () => {
        const sourcePath: string = path.resolve('workspace', 'src', 'main', 'java');
        const paths: ITestSourcePath[] = mergeTestSourcePaths(
            [{ testSourcePath: sourcePath, isStrict: false }], [sourcePath]);

        assert.deepStrictEqual(paths, [{ testSourcePath: sourcePath, isStrict: true }]);
    });

    test('expands source-root patterns and deduplicates overlapping matches', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const sourceRoots: string[] = [
            path.join(workspacePath, 'modules', 'app', 'src', 'main', 'java'),
            path.join(workspacePath, 'modules', 'cli', 'src', 'main', 'java'),
        ];
        sourceRoots.forEach((sourceRoot: string) => fse.ensureDirSync(sourceRoot));

        try {
            const paths: string[] = await resolveAdditionalTestSourcePaths(workspacePath, [
                'modules/*/src/main/java',
                'modules/app/src/main/java',
            ]);

            assert.deepStrictEqual(paths.sort(), sourceRoots.sort());
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('includes additional source roots in file watcher patterns', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const sourceRoots: string[] = [
            path.join(workspacePath, 'modules', 'app', 'src', 'main', 'java'),
            path.join(workspacePath, 'modules', 'cli', 'src', 'main', 'java'),
        ];
        sourceRoots.forEach((sourceRoot: string) => fse.ensureDirSync(sourceRoot));
        const workspaceFolder: WorkspaceFolder = {
            uri: Uri.file(workspacePath),
            name: 'additional-source-paths-test',
            index: 0,
        };
        const configuration: WorkspaceConfiguration = {
            get: () => ['modules/*/src/main/java'],
        } as unknown as WorkspaceConfiguration;

        testSourceProvider.clear();
        sinon.stub(workspace, 'getConfiguration').returns(configuration);
        sinon.stub(commandUtils, 'executeJavaLanguageServerCommand').resolves([]);
        try {
            const patterns: RelativePattern[] = await testSourceProvider.getTestSourcePattern(workspaceFolder);

            const normalizePath = (sourcePath: string): string => process.platform === 'win32'
                ? path.normalize(sourcePath).toLowerCase()
                : path.normalize(sourcePath);
            assert.deepStrictEqual(
                patterns.map((pattern: RelativePattern) => normalizePath(pattern.baseUri.fsPath)).sort(),
                sourceRoots.map(normalizePath).sort());
        } finally {
            testSourceProvider.clear();
            sinon.restore();
            fse.removeSync(workspacePath);
        }
    });

    test('supports Windows separators in source-root patterns', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const sourceRoot: string = path.join(workspacePath, 'modules', 'app', 'src', 'main', 'java');
        fse.ensureDirSync(sourceRoot);

        try {
            const paths: string[] = await resolveAdditionalTestSourcePaths(workspacePath, [
                'modules\\*\\src\\main\\java',
            ]);

            assert.deepStrictEqual(paths, [sourceRoot]);
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('ignores unmatched source-root patterns', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        try {
            const paths: string[] = await resolveAdditionalTestSourcePaths(workspacePath, [
                'modules/*/src/test/java',
            ]);

            assert.deepStrictEqual(paths, []);
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('ignores literal paths that do not exist as directories', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        try {
            const paths: string[] = await resolveAdditionalTestSourcePaths(workspacePath, ['modules/missing/src/main/java']);

            assert.deepStrictEqual(paths, []);
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('ignores blank paths', async () => {
        assert.deepStrictEqual(await resolveAdditionalTestSourcePaths(path.resolve('workspace'), [' ', '\t']), []);
    });
});
