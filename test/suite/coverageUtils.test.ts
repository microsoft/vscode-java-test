// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import * as coverageUtils from '../../src/utils/coverageUtils';
import { DebugConfiguration } from 'vscode';

// tslint:disable: only-arrow-functions
// tslint:disable: no-object-literal-type-assertion
suite('CoverageUtils Tests', () => {

    test('Use project jacoco agent if it is available', async () => {
        const debugConfiguration: DebugConfiguration = {
            name: 'Tests',
            type: 'java',
            request: 'launch',
            classPaths: [
                '/foo/bar/org.jacoco.agent-1.2.3-runtime.jar',
            ]
        }
        assert.strictEqual(
            coverageUtils.getJacocoAgentPath(debugConfiguration),
            '/foo/bar/org.jacoco.agent-1.2.3-runtime.jar'
        );
    });
});
