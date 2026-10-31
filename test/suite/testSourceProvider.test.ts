// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { RelativePattern, Uri, WorkspaceConfiguration, WorkspaceFolder, workspace } from 'vscode';
import * as commandUtils from '../../src/utils/commandUtils';
import { JavaTestRunnerDelegateCommands } from '../../src/constants';
import { ITestSourcePath, mergeTestSourcePaths, resolveAdditionalTestSourcePaths, testSourceProvider } from '../../src/provider/testSourceProvider';

suite('testSourceProvider', () => {
    test('returns no extra paths by default', async () => {
        assert.deepStrictEqual(await resolveAdditionalTestSourcePaths(path.resolve('workspace'), [], []), []);
    });

    test('resolves multiple relative paths against the workspace folder', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const relativePaths: string[] = [path.join('src', 'main', 'java'), path.join('src', 'integrationTest', 'java')];
        relativePaths.forEach((relativePath: string) => fse.ensureDirSync(path.join(workspacePath, relativePath)));
        try {
            const sourcePaths: string[] = await resolveAdditionalTestSourcePaths(
                workspacePath, relativePaths, relativePaths.map((relativePath: string) => path.resolve(workspacePath, relativePath)));

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
            ], [path.resolve(workspacePath, relativePath)]);

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
            ], sourceRoots);

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
        sinon.stub(testSourceProvider, 'getAdditionalTestSourcePaths').resolves(sourceRoots);
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

    test('resolves configured patterns only against imported Java source roots', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const importedRoot: string = path.join(workspacePath, 'modules', 'app', 'src', 'main', 'java');
        const unimportedPath: string = path.join(workspacePath, 'modules', 'scratch', 'src', 'main', 'java');
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
        const commandStub = sinon.stub(commandUtils, 'executeJavaLanguageServerCommand')
            .resolves([{ testSourcePath: importedRoot, isStrict: false }]);
        try {
            assert.deepStrictEqual(await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolder), [importedRoot]);
            sinon.assert.calledOnceWithExactly(commandStub,
                JavaTestRunnerDelegateCommands.GET_SOURCE_PATH, [workspaceFolder.uri.toString()]);
            assert.ok(![...await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolder)].includes(unimportedPath));
        } finally {
            testSourceProvider.clear();
            sinon.restore();
            fse.removeSync(workspacePath);
        }
    });

    test('recomputes additional source roots after cached paths are cleared', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const sourceRoots: string[] = [
            path.join(workspacePath, 'modules', 'app', 'src', 'main', 'java'),
            path.join(workspacePath, 'modules', 'cli', 'src', 'main', 'java'),
        ];
        let configuredPaths: string[] = ['modules/app/src/main/java'];
        const workspaceFolder: WorkspaceFolder = {
            uri: Uri.file(workspacePath),
            name: 'additional-source-paths-test',
            index: 0,
        };
        const configuration: WorkspaceConfiguration = {
            get: () => configuredPaths,
        } as unknown as WorkspaceConfiguration;

        testSourceProvider.clear();
        sinon.stub(workspace, 'getConfiguration').returns(configuration);
        const commandStub = sinon.stub(commandUtils, 'executeJavaLanguageServerCommand').resolves(
            sourceRoots.map((testSourcePath: string) => ({ testSourcePath, isStrict: false })));
        try {
            assert.deepStrictEqual(await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolder), [sourceRoots[0]]);
            configuredPaths = ['modules/cli/src/main/java'];
            assert.deepStrictEqual(await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolder), [sourceRoots[0]]);
            assert.strictEqual(commandStub.callCount, 1);

            testSourceProvider.clear();
            assert.deepStrictEqual(await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolder), [sourceRoots[1]]);
            assert.strictEqual(commandStub.callCount, 2);
        } finally {
            testSourceProvider.clear();
            sinon.restore();
            fse.removeSync(workspacePath);
        }
    });

    test('keeps additional source-root resolution separate for workspace folders', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        const workspaceFolderA: WorkspaceFolder = {
            uri: Uri.file(path.join(workspacePath, 'module-a')),
            name: 'module-a',
            index: 0,
        };
        const workspaceFolderB: WorkspaceFolder = {
            uri: Uri.file(path.join(workspacePath, 'module-b')),
            name: 'module-b',
            index: 1,
        };
        const sourceRootA: string = path.join(workspaceFolderA.uri.fsPath, 'src', 'main', 'java');
        const sourceRootB: string = path.join(workspaceFolderB.uri.fsPath, 'src', 'main', 'java');
        const configuration: WorkspaceConfiguration = {
            get: () => ['src/main/java'],
        } as unknown as WorkspaceConfiguration;

        testSourceProvider.clear();
        sinon.stub(workspace, 'getConfiguration').returns(configuration);
        const commandStub = sinon.stub(commandUtils, 'executeJavaLanguageServerCommand');
        commandStub.onFirstCall().resolves([{ testSourcePath: sourceRootA, isStrict: false }]);
        commandStub.onSecondCall().resolves([{ testSourcePath: sourceRootB, isStrict: false }]);
        try {
            assert.deepStrictEqual(await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolderA), [sourceRootA]);
            assert.deepStrictEqual(await testSourceProvider.getAdditionalTestSourcePaths(workspaceFolderB), [sourceRootB]);
            assert.strictEqual(commandStub.callCount, 2);
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
            ], [sourceRoot]);

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
            ], []);

            assert.deepStrictEqual(paths, []);
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('ignores literal paths that are not imported source roots', async () => {
        const workspacePath: string = fse.mkdtempSync(path.join(os.tmpdir(), 'java-test-source-paths-'));
        try {
            const paths: string[] = await resolveAdditionalTestSourcePaths(workspacePath,
                ['modules/missing/src/main/java'], []);

            assert.deepStrictEqual(paths, []);
        } finally {
            fse.removeSync(workspacePath);
        }
    });

    test('ignores blank paths', async () => {
        assert.deepStrictEqual(await resolveAdditionalTestSourcePaths(path.resolve('workspace'), [' ', '\t'], []), []);
    });
});
