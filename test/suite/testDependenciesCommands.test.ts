// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import { exportedForTesting } from '../../src/commands/testDependenciesCommands';

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion

const { parseLatestStableVersion, isStableVersion } = exportedForTesting;

suite('testDependenciesCommands - version source parsing', () => {

    suite('isStableVersion', () => {
        test('accepts pure dot-separated numeric versions', () => {
            assert.strictEqual(isStableVersion('6.1.0'), true);
            assert.strictEqual(isStableVersion('4.13.2'), true);
            assert.strictEqual(isStableVersion('1.14.4'), true);
            assert.strictEqual(isStableVersion('7'), true);
            assert.strictEqual(isStableVersion('1.0.0.0'), true);
        });

        test('rejects milestone, RC, beta, snapshot and other qualified versions', () => {
            assert.strictEqual(isStableVersion('1.13.0-M3'), false);
            assert.strictEqual(isStableVersion('1.0.0-RC1'), false);
            assert.strictEqual(isStableVersion('4.13-beta-1'), false);
            assert.strictEqual(isStableVersion('4.13-rc-2'), false);
            assert.strictEqual(isStableVersion('1.0-SNAPSHOT'), false);
            assert.strictEqual(isStableVersion('5.0.0-alpha'), false);
            assert.strictEqual(isStableVersion('6.0.0.preview'), false);
            assert.strictEqual(isStableVersion(''), false);
        });
    });

    suite('parseLatestStableVersion', () => {
        test('returns <release> when it is a stable version', () => {
            const xml: string = `
                <metadata>
                  <versioning>
                    <release>6.1.0</release>
                    <versions>
                      <version>6.0.0</version>
                      <version>6.1.0</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml), '6.1.0');
        });

        test('falls back to the newest stable <version> when <release> is a milestone', () => {
            // This is the exact shape that would have appeared had the upstream <release>
            // pointer drifted to a milestone — the same failure mode the stale
            // search.maven.org Solr index exhibited for years.
            const xml: string = `
                <metadata>
                  <versioning>
                    <release>1.13.0-M3</release>
                    <versions>
                      <version>1.13.0-M1</version>
                      <version>1.13.0-M2</version>
                      <version>1.13.0-M3</version>
                      <version>1.14.0</version>
                      <version>1.14.4</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml), '1.14.4');
        });

        test('returns the newest stable <version> when <release> is missing', () => {
            const xml: string = `
                <metadata>
                  <versioning>
                    <versions>
                      <version>4.13-beta-1</version>
                      <version>4.13</version>
                      <version>4.13.1</version>
                      <version>4.13.2</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml), '4.13.2');
        });

        test('skips trailing pre-releases and picks the most recent stable below them', () => {
            // <versions> ordering follows publication time, so the newest entry can be a
            // pre-release. The parser must walk backwards past it to the latest stable.
            const xml: string = `
                <metadata>
                  <versioning>
                    <versions>
                      <version>6.0.0</version>
                      <version>6.1.0</version>
                      <version>6.2.0-M1</version>
                      <version>6.2.0-RC1</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml), '6.1.0');
        });

        test('returns undefined when no stable version exists anywhere', () => {
            const xml: string = `
                <metadata>
                  <versioning>
                    <release>1.0.0-RC1</release>
                    <versions>
                      <version>1.0.0-M1</version>
                      <version>1.0.0-RC1</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml), undefined);
        });

        test('returns undefined for malformed input', () => {
            assert.strictEqual(parseLatestStableVersion(''), undefined);
            assert.strictEqual(parseLatestStableVersion('<html>404 Not Found</html>'), undefined);
        });
    });

    suite('parseLatestStableVersion with versionLine', () => {
        // Real-world shape: junit-platform-console-standalone publishes both the
        // 1.x and 6.x lines under the same GAV, with <release> tracking the
        // globally newest stable (6.x).
        const COEXISTING_LINES_XML: string = `
            <metadata>
              <versioning>
                <release>6.1.0</release>
                <versions>
                  <version>1.13.0</version>
                  <version>1.14.0-RC1</version>
                  <version>1.14.0</version>
                  <version>1.14.4</version>
                  <version>6.0.0-RC1</version>
                  <version>6.0.0</version>
                  <version>6.1.0-M1</version>
                  <version>6.1.0</version>
                </versions>
              </versioning>
            </metadata>`;

        test('selects the newest stable version in the requested line', () => {
            assert.strictEqual(parseLatestStableVersion(COEXISTING_LINES_XML, '1'), '1.14.4');
            assert.strictEqual(parseLatestStableVersion(COEXISTING_LINES_XML, '6'), '6.1.0');
        });

        test('ignores <release> when it points outside the requested line', () => {
            // <release> = 6.1.0 but caller asked for the 1.x line — we must not
            // short-circuit to <release>; we have to walk <versions>.
            assert.strictEqual(parseLatestStableVersion(COEXISTING_LINES_XML, '1'), '1.14.4');
        });

        test('skips pre-releases inside the requested line', () => {
            const xml: string = `
                <metadata>
                  <versioning>
                    <versions>
                      <version>1.14.3</version>
                      <version>1.14.4</version>
                      <version>1.15.0-M1</version>
                      <version>1.15.0-RC1</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml, '1'), '1.14.4');
        });

        test('returns undefined when the requested line has no stable version', () => {
            assert.strictEqual(parseLatestStableVersion(COEXISTING_LINES_XML, '2'), undefined);
            assert.strictEqual(parseLatestStableVersion(COEXISTING_LINES_XML, '5'), undefined);
        });

        test('matches the line only on the leading segment, not on prefix', () => {
            // versionLine '1' must not accidentally match '10.x' or '11.x'.
            const xml: string = `
                <metadata>
                  <versioning>
                    <versions>
                      <version>1.14.4</version>
                      <version>10.0.0</version>
                      <version>11.2.3</version>
                    </versions>
                  </versioning>
                </metadata>`;
            assert.strictEqual(parseLatestStableVersion(xml, '1'), '1.14.4');
            assert.strictEqual(parseLatestStableVersion(xml, '10'), '10.0.0');
            assert.strictEqual(parseLatestStableVersion(xml, '11'), '11.2.3');
        });
    });
});
