// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Enforces the same minimum release age as the CFS npm quarantine without
 * requiring access to the internal feed.
 *
 * The trusted pull_request_target workflow runs this script from the base
 * revision. The pull request's package-lock.json is downloaded and parsed as
 * data; no code from the pull request is checked out or executed.
 */

'use strict';

const fs = require('fs').promises;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MINIMUM_AGE_DAYS = 7;
const MAX_NEW_PACKAGE_VERSIONS = 200;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_LOCKFILE_BYTES = 10 * 1024 * 1024;
const MAX_PACKUMENT_BYTES = 50 * 1024 * 1024;
const MAX_STATUS_RESPONSE_BYTES = 1024 * 1024;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20000;
const RETRY_BASE_DELAY_MS = 1000;
const METADATA_CONCURRENCY = 4;
const NPM_REGISTRY = 'https://registry.npmjs.org';
const STATUS_CONTEXT = 'npm-package-minimum-release-age';

const REGISTRY_HOSTS = new Set([
    'registry.npmjs.org',
    'registry.yarnpkg.com',
    'packagefeedproxy.microsoft.io',
    'pkgs.dev.azure.com',
]);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function packageNameFromLockPath(packagePath) {
    const marker = 'node_modules/';
    const markerIndex = packagePath.lastIndexOf(marker);
    if (markerIndex < 0) {
        return undefined;
    }

    const pathAfterMarker = packagePath.slice(markerIndex + marker.length);
    const segments = pathAfterMarker.split('/');
    if (segments[0].startsWith('@') && segments.length >= 2) {
        return `${segments[0]}/${segments[1]}`;
    }
    return segments[0] || undefined;
}

function isNpmRegistryResolution(resolved) {
    if (typeof resolved !== 'string') {
        return false;
    }

    try {
        const host = new URL(resolved).hostname.toLowerCase();
        return REGISTRY_HOSTS.has(host) || host.endsWith('.pkgs.visualstudio.com');
    } catch {
        return false;
    }
}

function packageVersionKey(name, version, source) {
    return `${name}\0${version}\0${source}`;
}

function collectPackageVersions(lockfile) {
    if (!lockfile || typeof lockfile !== 'object' || !lockfile.packages || typeof lockfile.packages !== 'object') {
        throw new Error('package-lock.json must use lockfileVersion 2 or newer and contain a packages object.');
    }

    const versions = new Map();
    for (const [packagePath, entry] of Object.entries(lockfile.packages)) {
        if (!packagePath.includes('node_modules/') || !entry || typeof entry !== 'object' || entry.link === true) {
            continue;
        }
        if (typeof entry.version !== 'string') {
            continue;
        }

        const name = typeof entry.name === 'string'
            ? entry.name
            : packageNameFromLockPath(packagePath);
        if (!name) {
            throw new Error(`Unable to determine the package name for lockfile entry "${packagePath}".`);
        }

        const registryPackage = isNpmRegistryResolution(entry.resolved);
        const source = registryPackage ? 'npm' : String(entry.resolved || 'missing resolution');
        const key = packageVersionKey(name, entry.version, source);
        if (!versions.has(key)) {
            versions.set(key, {
                name,
                version: entry.version,
                resolved: entry.resolved,
                registryPackage,
            });
        }
    }
    return [...versions.values()];
}

function findNewPackageVersions(baseLockfile, headLockfile) {
    const baseVersions = new Set(
        collectPackageVersions(baseLockfile)
            .map(({ name, version, registryPackage, resolved }) => {
                const source = registryPackage ? 'npm' : String(resolved || 'missing resolution');
                return packageVersionKey(name, version, source);
            })
    );

    return collectPackageVersions(headLockfile)
        .filter(({ name, version, registryPackage, resolved }) => {
            const source = registryPackage ? 'npm' : String(resolved || 'missing resolution');
            return !baseVersions.has(packageVersionKey(name, version, source));
        })
        .sort((left, right) => {
            const nameOrder = left.name.localeCompare(right.name);
            return nameOrder !== 0 ? nameOrder : left.version.localeCompare(right.version);
        });
}

function dependencySection(value, sectionName) {
    if (value === undefined) {
        return {};
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${sectionName} must be an object.`);
    }
    return value;
}

function sortedEntries(value) {
    return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

function assertManifestMatchesLockfile(manifest, lockfile) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error('package.json must contain a JSON object.');
    }
    const lockfileRoot = lockfile?.packages?.[''];
    if (!lockfileRoot || typeof lockfileRoot !== 'object') {
        throw new Error('package-lock.json does not contain the root package entry.');
    }

    const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
    for (const section of sections) {
        const manifestEntries = sortedEntries(dependencySection(manifest[section], `package.json ${section}`));
        const lockfileEntries = sortedEntries(dependencySection(lockfileRoot[section], `package-lock.json ${section}`));
        if (JSON.stringify(manifestEntries) !== JSON.stringify(lockfileEntries)) {
            throw new Error(`package-lock.json is not synchronized with package.json ${section}. Run npm install and commit the result.`);
        }
    }
}

function validateRepository(repository) {
    if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
        throw new Error(`Invalid GitHub repository name: "${repository}".`);
    }
}

function validateCommitSha(sha) {
    if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) {
        throw new Error(`Invalid Git commit SHA: "${sha}".`);
    }
}

function rawRepositoryFileUrl(repository, sha, filePath) {
    validateRepository(repository);
    validateCommitSha(sha);
    const [owner, name] = repository.split('/');
    const encodedPath = filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${sha}/${encodedPath}`;
}

function rawLockfileUrl(repository, sha) {
    return rawRepositoryFileUrl(repository, sha, 'package-lock.json');
}

function npmMetadataUrl(packageName) {
    return `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`;
}

function nonRetryableError(message) {
    const error = new Error(message);
    error.retryable = false;
    return error;
}

async function fetchTextWithRetry(url, maximumBytes, fetchImpl = fetch, init = {}) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetchImpl(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'vscode-java-test-package-age-check',
                    ...init.headers,
                },
                method: init.method,
                body: init.body,
                signal: controller.signal,
            });
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
                error.retryable = response.status === 429 || response.status >= 500;
                throw error;
            }

            const contentLength = Number(response.headers.get('content-length'));
            if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
                throw nonRetryableError(`Response from ${url} exceeds the ${maximumBytes}-byte limit.`);
            }

            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length > maximumBytes) {
                throw nonRetryableError(`Response from ${url} exceeds the ${maximumBytes}-byte limit.`);
            }
            return bytes.toString('utf8');
        } catch (error) {
            lastError = error;
            if (error.retryable === false || attempt === MAX_ATTEMPTS) {
                break;
            }
            const delay = RETRY_BASE_DELAY_MS * attempt;
            console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} for ${url} failed: ${error.message}. Retrying in ${delay}ms.`);
            await sleep(delay);
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError;
}

async function fetchJsonWithRetry(url, maximumBytes, fetchImpl = fetch, init = {}) {
    const text = await fetchTextWithRetry(url, maximumBytes, fetchImpl, init);
    try {
        return JSON.parse(text);
    } catch {
        throw nonRetryableError(`Response from ${url} is not valid JSON.`);
    }
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex++;
            results[currentIndex] = await mapper(items[currentIndex]);
        }
    }

    const workers = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return results;
}

async function fetchPackageMetadata(packages, fetchImpl = fetch) {
    const names = [...new Set(packages.map(({ name }) => name))];
    const entries = await mapWithConcurrency(names, METADATA_CONCURRENCY, async (name) => {
        const metadata = await fetchJsonWithRetry(npmMetadataUrl(name), MAX_PACKUMENT_BYTES, fetchImpl);
        return [name, metadata];
    });
    return new Map(entries);
}

function classifyPackageVersions(packages, metadataByName, now, minimumAgeMs) {
    return packages.map((pkg) => {
        if (!pkg.registryPackage) {
            return {
                ...pkg,
                error: `Cannot verify npm publish time for ${pkg.name}@${pkg.version} from "${pkg.resolved || 'an unknown source'}".`,
            };
        }

        const publishedValue = metadataByName.get(pkg.name)?.time?.[pkg.version];
        const publishedAtMs = Date.parse(publishedValue);
        if (!publishedValue || !Number.isFinite(publishedAtMs)) {
            return {
                ...pkg,
                error: `npm metadata does not contain a valid publish time for ${pkg.name}@${pkg.version}.`,
            };
        }

        const eligibleAtMs = publishedAtMs + minimumAgeMs;
        return {
            ...pkg,
            publishedAt: new Date(publishedAtMs).toISOString(),
            eligibleAt: new Date(eligibleAtMs).toISOString(),
            eligible: now >= eligibleAtMs,
            remainingMs: Math.max(0, eligibleAtMs - now),
        };
    });
}

function formatDuration(milliseconds) {
    const totalMinutes = Math.ceil(milliseconds / (60 * 1000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    parts.push(`${minutes}m`);
    return parts.join(' ');
}

async function writeStepSummary(results, minimumAgeDays) {
    if (!process.env.GITHUB_STEP_SUMMARY) {
        return;
    }

    const lines = [
        `## NPM package minimum release age: ${minimumAgeDays} days`,
        '',
    ];
    if (results.length === 0) {
        lines.push('No new npm package versions were introduced.');
    } else {
        lines.push('| Package | Published | Eligible after | Result |');
        lines.push('|---|---|---|---|');
        for (const result of results) {
            const status = result.error
                ? `Error: ${result.error}`
                : result.eligible ? 'Pass' : `Fail (${formatDuration(result.remainingMs)} remaining)`;
            lines.push(`| \`${result.name}@${result.version}\` | ${result.publishedAt || '-'} | ${result.eligibleAt || '-'} | ${status} |`);
        }
    }
    lines.push('');
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

function pullRequestCoordinates(event) {
    const pullRequest = event?.pull_request;
    const baseRepository = pullRequest?.base?.repo?.full_name;
    const headRepository = pullRequest?.head?.repo?.full_name;
    const baseSha = pullRequest?.base?.sha;
    const headSha = pullRequest?.head?.sha;
    if (!baseRepository || !headRepository || !baseSha || !headSha) {
        throw new Error('GITHUB_EVENT_PATH does not contain complete pull request repository and commit information.');
    }
    return { baseRepository, baseSha, headRepository, headSha };
}

function statusDescription(description) {
    return description.length <= 140 ? description : `${description.slice(0, 137)}...`;
}

async function postCommitStatus(repository, sha, state, description, fetchImpl = fetch) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('GITHUB_TOKEN is required to publish the package-age commit status.');
    }

    validateRepository(repository);
    validateCommitSha(sha);
    const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
    const runUrl = process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined;
    const body = {
        state,
        context: STATUS_CONTEXT,
        description: statusDescription(description),
    };
    if (runUrl) {
        body.target_url = runUrl;
    }

    await fetchJsonWithRetry(
        `${apiUrl}/repos/${repository}/statuses/${sha}`,
        MAX_STATUS_RESPONSE_BYTES,
        fetchImpl,
        {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify(body),
        }
    );
}

async function main() {
    const minimumAgeDays = Number(process.env.MINIMUM_RELEASE_AGE_DAYS || DEFAULT_MINIMUM_AGE_DAYS);
    if (!Number.isFinite(minimumAgeDays) || minimumAgeDays <= 0) {
        throw new Error(`MINIMUM_RELEASE_AGE_DAYS must be a positive number, received "${process.env.MINIMUM_RELEASE_AGE_DAYS}".`);
    }

    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) {
        throw new Error('GITHUB_EVENT_PATH is required.');
    }

    const event = JSON.parse(await fs.readFile(eventPath, 'utf8'));
    const coordinates = pullRequestCoordinates(event);
    const { baseRepository, baseSha, headRepository, headSha } = coordinates;
    const requireCommitStatus = process.env.REQUIRE_COMMIT_STATUS === 'true';
    const reportStatus = async (state, description) => {
        if (!requireCommitStatus) {
            return;
        }
        await postCommitStatus(baseRepository, headSha, state, description);
    };

    if (requireCommitStatus && !process.env.GITHUB_TOKEN) {
        throw new Error('REQUIRE_COMMIT_STATUS is true but GITHUB_TOKEN is unavailable.');
    }

    await reportStatus('pending', 'Checking npm package release ages.');
    try {
        console.log(`Comparing ${baseRepository}@${baseSha} with ${headRepository}@${headSha}.`);

        const [baseLockfile, headLockfile, headManifest] = await Promise.all([
            fetchJsonWithRetry(rawLockfileUrl(baseRepository, baseSha), MAX_LOCKFILE_BYTES),
            fetchJsonWithRetry(rawLockfileUrl(headRepository, headSha), MAX_LOCKFILE_BYTES),
            fetchJsonWithRetry(rawRepositoryFileUrl(headRepository, headSha, 'package.json'), MAX_MANIFEST_BYTES),
        ]);
        assertManifestMatchesLockfile(headManifest, headLockfile);

        const newPackages = findNewPackageVersions(baseLockfile, headLockfile);
        if (newPackages.length > MAX_NEW_PACKAGE_VERSIONS) {
            throw new Error(
                `The pull request introduces ${newPackages.length} npm package versions, exceeding the safety limit of ${MAX_NEW_PACKAGE_VERSIONS}.`
            );
        }

        if (newPackages.length === 0) {
            console.log('No new npm package versions were introduced.');
            await writeStepSummary([], minimumAgeDays);
            await reportStatus('success', 'No new npm package versions were introduced.');
            return;
        }

        console.log(`Checking ${newPackages.length} newly introduced npm package version(s).`);
        const metadata = await fetchPackageMetadata(newPackages.filter(({ registryPackage }) => registryPackage));
        const results = classifyPackageVersions(
            newPackages,
            metadata,
            Date.now(),
            minimumAgeDays * DAY_MS
        );
        await writeStepSummary(results, minimumAgeDays);

        let failureCount = 0;
        for (const result of results) {
            if (result.error) {
                failureCount++;
                console.error(`::error title=NPM publish time unavailable::${result.error}`);
            } else if (!result.eligible) {
                failureCount++;
                console.error(
                    `::error title=NPM package is too new::${result.name}@${result.version} was published at ${result.publishedAt}; ` +
                    `it becomes eligible at ${result.eligibleAt} (${formatDuration(result.remainingMs)} remaining).`
                );
            } else {
                console.log(`${result.name}@${result.version} passed: published ${result.publishedAt}.`);
            }
        }

        if (failureCount > 0) {
            throw new Error(
                `${failureCount} newly introduced npm package version(s) have not satisfied the ${minimumAgeDays}-day minimum release age.`
            );
        }
        console.log(`All newly introduced npm package versions are at least ${minimumAgeDays} days old.`);
        await reportStatus('success', `All new npm package versions are at least ${minimumAgeDays} days old.`);
    } catch (error) {
        try {
            await reportStatus('failure', error.message);
        } catch (statusError) {
            console.error(`::error title=Unable to publish failure status::${statusError.message}`);
        }
        throw error;
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`::error title=NPM package age check failed::${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    DAY_MS,
    assertManifestMatchesLockfile,
    classifyPackageVersions,
    collectPackageVersions,
    findNewPackageVersions,
    formatDuration,
    isNpmRegistryResolution,
    npmMetadataUrl,
    packageNameFromLockPath,
    postCommitStatus,
    pullRequestCoordinates,
    rawLockfileUrl,
    rawRepositoryFileUrl,
};
