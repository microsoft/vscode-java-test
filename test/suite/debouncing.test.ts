// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import { BoundedCache } from '../../src/utils/BoundedCache';

// tslint:disable: only-arrow-functions
suite('Debouncing Tests', () => {

    test('evicts the least recently used entry', () => {
        const cache: BoundedCache<string, number> = new BoundedCache<string, number>(2);
        cache.set('first', 1);
        cache.set('second', 2);

        assert.strictEqual(cache.get('first'), 1);
        cache.set('third', 3);

        assert.strictEqual(cache.get('second'), undefined);
        assert.strictEqual(cache.get('first'), 1);
        assert.strictEqual(cache.get('third'), 3);
    });
});
