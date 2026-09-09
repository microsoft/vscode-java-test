// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

const assert = require('assert/strict');
const test = require('node:test');

const {
    DAY_MS,
    assertManifestMatchesLockfile,
    classifyPackageVersions,
    findNewPackageVersions,
    formatDuration,
    npmMetadataUrl,
    packageNameFromLockPath,
    postCommitStatus,
    pullRequestCoordinates,
    rawLockfileUrl,
} = require('./checkNpmPackageAge');

function registryEntry(name, version) {
    const tarballName = name.split('/').pop();
    return {
        version,
        resolved: `https://registry.npmjs.org/${name}/-/${tarballName}-${version}.tgz`,
    };
}

function lockfile(packages) {
    return {
        lockfileVersion: 3,
        packages: {
            '': {},
            ...packages,
        },
    };
}

test('derives package names from nested and scoped lockfile paths', () => {
    assert.equal(packageNameFromLockPath('node_modules/foo'), 'foo');
    assert.equal(packageNameFromLockPath('node_modules/parent/node_modules/foo'), 'foo');
    assert.equal(packageNameFromLockPath('node_modules/@scope/pkg'), '@scope/pkg');
    assert.equal(packageNameFromLockPath('node_modules/parent/node_modules/@scope/pkg'), '@scope/pkg');
    assert.equal(packageNameFromLockPath('packages/local'), undefined);
});

test('finds only package versions newly introduced by the pull request', () => {
    const base = lockfile({
        'node_modules/foo': registryEntry('foo', '1.0.0'),
        'node_modules/shared': registryEntry('shared', '2.0.0'),
    });
    const head = lockfile({
        'node_modules/foo': registryEntry('foo', '2.0.0'),
        'node_modules/parent/node_modules/shared': registryEntry('shared', '2.0.0'),
        'node_modules/@scope/new-package': registryEntry('@scope/new-package', '3.0.0'),
    });

    assert.deepEqual(
        findNewPackageVersions(base, head).map(({ name, version }) => `${name}@${version}`),
        ['@scope/new-package@3.0.0', 'foo@2.0.0']
    );
});

test('uses a lockfile entry name for npm aliases', () => {
    const base = lockfile({});
    const head = lockfile({
        'node_modules/package-alias': {
            ...registryEntry('actual-package', '1.2.3'),
            name: 'actual-package',
        },
    });

    assert.deepEqual(
        findNewPackageVersions(base, head).map(({ name, version }) => `${name}@${version}`),
        ['actual-package@1.2.3']
    );
});

test('retains newly introduced packages whose publish time cannot be verified', () => {
    const additions = findNewPackageVersions(lockfile({}), lockfile({
        'node_modules/from-git': {
            version: '1.0.0',
            resolved: 'git+https://github.com/example/from-git.git',
        },
    }));

    assert.equal(additions.length, 1);
    assert.equal(additions[0].registryPackage, false);
    const [result] = classifyPackageVersions(additions, new Map(), Date.now(), 7 * DAY_MS);
    assert.match(result.error, /Cannot verify npm publish time/);
});

test('requires package.json and package-lock.json dependency sections to match', () => {
    const manifest = {
        dependencies: { foo: '^1.0.0' },
        devDependencies: { bar: '^2.0.0' },
    };
    const matchingLockfile = lockfile({});
    matchingLockfile.packages[''] = {
        dependencies: { foo: '^1.0.0' },
        devDependencies: { bar: '^2.0.0' },
    };
    assert.doesNotThrow(() => assertManifestMatchesLockfile(manifest, matchingLockfile));

    matchingLockfile.packages[''].dependencies.foo = '^1.1.0';
    assert.throws(
        () => assertManifestMatchesLockfile(manifest, matchingLockfile),
        /not synchronized/
    );
});

test('enforces the minimum release age at the exact boundary', () => {
    const now = Date.parse('2026-09-09T00:00:00.000Z');
    const packages = [
        { name: 'old', version: '1.0.0', registryPackage: true },
        { name: 'exact', version: '1.0.0', registryPackage: true },
        { name: 'young', version: '1.0.0', registryPackage: true },
        { name: 'missing', version: '1.0.0', registryPackage: true },
    ];
    const metadata = new Map([
        ['old', { time: { '1.0.0': '2026-09-01T23:59:59.000Z' } }],
        ['exact', { time: { '1.0.0': '2026-09-02T00:00:00.000Z' } }],
        ['young', { time: { '1.0.0': '2026-09-02T00:00:01.000Z' } }],
        ['missing', { time: {} }],
    ]);

    const results = classifyPackageVersions(packages, metadata, now, 7 * DAY_MS);
    assert.equal(results[0].eligible, true);
    assert.equal(results[1].eligible, true);
    assert.equal(results[2].eligible, false);
    assert.equal(results[2].remainingMs, 1000);
    assert.match(results[3].error, /does not contain a valid publish time/);
});

test('builds encoded registry and raw GitHub URLs', () => {
    assert.equal(
        npmMetadataUrl('@scope/package'),
        'https://registry.npmjs.org/%40scope%2Fpackage'
    );
    assert.equal(
        rawLockfileUrl('microsoft/vscode-java-test', '0123456789abcdef0123456789abcdef01234567'),
        'https://raw.githubusercontent.com/microsoft/vscode-java-test/0123456789abcdef0123456789abcdef01234567/package-lock.json'
    );
});

test('validates pull request coordinates and formats wait durations', () => {
    const coordinates = pullRequestCoordinates({
        pull_request: {
            base: {
                repo: { full_name: 'microsoft/vscode-java-test' },
                sha: '0123456789abcdef0123456789abcdef01234567',
            },
            head: {
                repo: { full_name: 'contributor/vscode-java-test' },
                sha: '89abcdef0123456789abcdef0123456789abcdef',
            },
        },
    });

    assert.equal(coordinates.headRepository, 'contributor/vscode-java-test');
    assert.equal(formatDuration(1), '1m');
    assert.equal(formatDuration(DAY_MS + 61 * 60 * 1000), '1d 1h 1m');
});

test('publishes a named commit status for the pull request SHA', async () => {
    const originalEnvironment = {
        GITHUB_API_URL: process.env.GITHUB_API_URL,
        GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
        GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    };
    process.env.GITHUB_API_URL = 'https://api.github.test';
    process.env.GITHUB_RUN_ID = '1234';
    process.env.GITHUB_SERVER_URL = 'https://github.test';
    process.env.GITHUB_TOKEN = 'test-token';

    let request;
    const fetchImpl = async (url, init) => {
        request = { url, init };
        return {
            ok: true,
            status: 201,
            statusText: 'Created',
            headers: new Map([['content-length', '2']]),
            arrayBuffer: async () => Buffer.from('{}'),
        };
    };

    try {
        await postCommitStatus(
            'microsoft/vscode-java-test',
            '0123456789abcdef0123456789abcdef01234567',
            'success',
            'Package versions are old enough.',
            fetchImpl
        );
    } finally {
        for (const [name, value] of Object.entries(originalEnvironment)) {
            if (value === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = value;
            }
        }
    }

    assert.equal(
        request.url,
        'https://api.github.test/repos/microsoft/vscode-java-test/statuses/0123456789abcdef0123456789abcdef01234567'
    );
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(request.init.body), {
        state: 'success',
        context: 'npm-package-minimum-release-age',
        description: 'Package versions are old enough.',
        target_url: 'https://github.test/microsoft/vscode-java-test/actions/runs/1234',
    });
});
