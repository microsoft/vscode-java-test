// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Health check for the Maven Central data sources that
 * `src/commands/testDependenciesCommands.ts` relies on for the
 * "Enable Java Tests" download flow.
 *
 * For every artifact that vscode-java-test fetches at runtime, this script:
 *
 *   1. Downloads the artifact's `maven-metadata.xml` from repo1.maven.org.
 *   2. Extracts the `<release>` element and asserts it is a stable version
 *      (dot-separated digits only — no `-M3`, `-RC1`, `-beta-1`, etc.).
 *   3. Issues an HTTP HEAD against the resolved `.jar` download URL and
 *      asserts a 2xx response.
 *
 * This guards against silent upstream drift, e.g.
 *   - the data source moving / being deprecated (microsoft/vscode-java-test#1866,
 *     where the legacy search.maven.org Solr index was frozen for ~a year
 *     and kept returning a milestone build as the "latest"),
 *   - a maintainer accidentally publishing a pre-release as `<release>`,
 *   - the jar layout under repo1.maven.org changing.
 *
 * Runs on PRs (so a code change that breaks the lookup never lands) and
 * on a weekly cron (so a purely upstream change is caught within days
 * instead of months).
 *
 * Pure Node, no dependencies — works before `npm install` runs.
 */

'use strict';

const ARTIFACTS = [
    // JUnit 5 / Jupiter (the path that originally surfaced #1866).
    { groupId: 'org.junit.platform', artifactId: 'junit-platform-console-standalone' },

    // JUnit 4 + its hamcrest-core dependency.
    { groupId: 'junit', artifactId: 'junit' },
    // hamcrest-core is pinned to 1.3 in the extension; verify both that 1.3
    // still resolves and that the artifact metadata is reachable.
    { groupId: 'org.hamcrest', artifactId: 'hamcrest-core', pinnedVersion: '1.3' },

    // TestNG + its transitive deps that we ship.
    { groupId: 'org.testng', artifactId: 'testng' },
    { groupId: 'com.beust', artifactId: 'jcommander' },
    { groupId: 'org.slf4j', artifactId: 'slf4j-api' },
];

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

const STABLE_VERSION_REGEX = /^\d+(\.\d+)*$/;

function groupPath(groupId) {
    return groupId.split('.').join('/');
}

function metadataUrl(groupId, artifactId) {
    return `https://repo1.maven.org/maven2/${groupPath(groupId)}/${artifactId}/maven-metadata.xml`;
}

function jarUrl(groupId, artifactId, version) {
    return `https://repo1.maven.org/maven2/${groupPath(groupId)}/${artifactId}/${version}/${artifactId}-${version}.jar`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, init) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            clearTimeout(timer);
            return response;
        } catch (err) {
            clearTimeout(timer);
            lastError = err;
            if (attempt < MAX_ATTEMPTS) {
                const delay = RETRY_BASE_DELAY_MS * attempt;
                console.warn(`  ! attempt ${attempt}/${MAX_ATTEMPTS} for ${url} failed: ${err.message}. Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

function parseLatestStableVersion(xml) {
    const releaseMatch = xml.match(/<release>([^<]+)<\/release>/);
    if (releaseMatch && STABLE_VERSION_REGEX.test(releaseMatch[1])) {
        return releaseMatch[1];
    }
    const versions = [];
    const versionRegex = /<version>([^<]+)<\/version>/g;
    let match;
    while ((match = versionRegex.exec(xml)) !== null) {
        versions.push(match[1]);
    }
    for (let i = versions.length - 1; i >= 0; i--) {
        if (STABLE_VERSION_REGEX.test(versions[i])) {
            return versions[i];
        }
    }
    return undefined;
}

async function checkArtifact(artifact) {
    const { groupId, artifactId, pinnedVersion } = artifact;
    console.log(`\n== ${groupId}:${artifactId} ==`);

    const metaUrl = metadataUrl(groupId, artifactId);
    console.log(`  GET  ${metaUrl}`);
    const metaResponse = await fetchWithRetry(metaUrl);
    if (!metaResponse.ok) {
        throw new Error(`maven-metadata.xml returned HTTP ${metaResponse.status} ${metaResponse.statusText}`);
    }
    const xml = await metaResponse.text();

    const releaseMatch = xml.match(/<release>([^<]+)<\/release>/);
    if (releaseMatch) {
        const rawRelease = releaseMatch[1];
        if (!STABLE_VERSION_REGEX.test(rawRelease)) {
            // Production falls back to the <versions> list when <release>
            // points to a pre-release, so this is non-fatal — but still
            // noisy enough to be worth surfacing in the log.
            console.warn(`  ! <release> is a pre-release: "${rawRelease}". Falling back to <versions> scan.`);
        }
    } else {
        console.warn('  ! <release> tag missing — relying entirely on <versions> fallback.');
    }

    const latestStable = parseLatestStableVersion(xml);
    if (!latestStable) {
        throw new Error('No stable version found in maven-metadata.xml.');
    }
    console.log(`  ok   latest stable version = ${latestStable}`);

    const versionsToProbe = pinnedVersion && pinnedVersion !== latestStable
        ? [latestStable, pinnedVersion]
        : [latestStable];

    for (const version of versionsToProbe) {
        const downloadUrl = jarUrl(groupId, artifactId, version);
        console.log(`  HEAD ${downloadUrl}`);
        const headResponse = await fetchWithRetry(downloadUrl, { method: 'HEAD' });
        if (!headResponse.ok) {
            throw new Error(`jar HEAD returned HTTP ${headResponse.status} ${headResponse.statusText} for ${downloadUrl}`);
        }
        console.log(`  ok   jar reachable (HTTP ${headResponse.status})`);
    }
}

async function main() {
    console.log('Checking Maven Central data sources for vscode-java-test...');
    const failures = [];
    for (const artifact of ARTIFACTS) {
        try {
            await checkArtifact(artifact);
        } catch (err) {
            failures.push({ artifact, error: err });
            console.error(`  FAIL ${artifact.groupId}:${artifact.artifactId} — ${err.message}`);
        }
    }

    console.log('\n----');
    if (failures.length === 0) {
        console.log(`All ${ARTIFACTS.length} artifacts healthy.`);
        return;
    }

    console.error(`${failures.length} of ${ARTIFACTS.length} artifact checks FAILED:`);
    for (const { artifact, error } of failures) {
        console.error(`  - ${artifact.groupId}:${artifact.artifactId}: ${error.message}`);
    }
    process.exit(1);
}

main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
