// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as LRUCache from 'lru-cache';
import { Uri } from 'vscode';

export const lruCache: LRUCache<Uri, MovingAverage> = new LRUCache<Uri, MovingAverage>(32);

// See: https://github.com/microsoft/vscode/blob/94c9ea46838a9a619aeafb7e8afd1170c967bb55/src/vs/base/common/numbers.ts
export class MovingAverage {

    private _n: number = 1;
    private _val: number = 0;

    public update(value: number): this {
        this._val = this._val + (value - this._val) / this._n;
        this._n += 1;
        return this;
    }

    public get value(): number {
        return this._val;
    }
}

export function getRequestDelay(uri: Uri): number {
    const avg: MovingAverage | undefined = lruCache.get(uri);
    if (!avg) {
        return 350;
    }
    // See: https://github.com/microsoft/vscode/blob/94c9ea46838a9a619aeafb7e8afd1170c967bb55/src/vs/editor/common/modes/languageFeatureRegistry.ts#L204
    return Math.max(350, Math.floor(1.3 * avg.value));
}
