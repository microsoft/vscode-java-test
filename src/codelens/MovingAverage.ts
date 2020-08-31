// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

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
