// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class BoundedCache<K, V> {

    private readonly entries: Map<K, V> = new Map<K, V>();

    constructor(private readonly maxSize: number) {
    }

    public get(key: K): V | undefined {
        const value: V | undefined = this.entries.get(key);
        if (value !== undefined) {
            this.entries.delete(key);
            this.entries.set(key, value);
        }
        return value;
    }

    public set(key: K, value: V): void {
        this.entries.delete(key);
        this.entries.set(key, value);
        if (this.entries.size > this.maxSize) {
            const oldest: IteratorResult<K> = this.entries.keys().next();
            if (!oldest.done) {
                this.entries.delete(oldest.value);
            }
        }
    }
}
