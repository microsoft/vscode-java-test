// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';
import { ITestSourcePath, mergeTestSourcePaths, resolveAdditionalTestSourcePaths } from '../../src/provider/testSourceProvider';

suite('testSourceProvider', () => {
    test('returns no extra paths by default', () => {
        assert.deepStrictEqual(resolveAdditionalTestSourcePaths(path.resolve('workspace'), []), []);
    });

    test('resolves multiple relative paths against the workspace folder', () => {
        const workspacePath: string = path.resolve('workspace');
        const sourcePaths: string[] = resolveAdditionalTestSourcePaths(workspacePath, [
            path.join('src', 'main', 'java'),
            path.join('src', 'integrationTest', 'java'),
        ]);

        assert.deepStrictEqual(sourcePaths, [
            path.resolve(workspacePath, 'src', 'main', 'java'),
            path.resolve(workspacePath, 'src', 'integrationTest', 'java'),
        ]);
    });

    test('deduplicates equivalent Windows path spellings', () => {
        const workspacePath: string = path.resolve('workspace');
        const relativePath: string = path.join('src', 'main', 'java');
        const sourcePaths: string[] = resolveAdditionalTestSourcePaths(workspacePath, [
            relativePath,
            relativePath.replace(/\\/g, '/'),
            path.resolve(workspacePath, relativePath),
        ]);

        assert.deepStrictEqual(sourcePaths, [path.resolve(workspacePath, relativePath)]);
    });

    test('merges an additional path already discovered by Java without duplicating it', () => {
        const sourcePath: string = path.resolve('workspace', 'src', 'main', 'java');
        const paths: ITestSourcePath[] = mergeTestSourcePaths(
            [{ testSourcePath: sourcePath, isStrict: false }], [sourcePath]);

        assert.deepStrictEqual(paths, [{ testSourcePath: sourcePath, isStrict: true }]);
    });

    test('ignores blank paths', () => {
        assert.deepStrictEqual(resolveAdditionalTestSourcePaths(path.resolve('workspace'), [' ', '\t']), []);
    });
});