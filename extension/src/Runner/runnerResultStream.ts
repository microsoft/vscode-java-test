// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as events from "events";
import { Readable } from "stream";

export class RunnerResultStream extends events.EventEmitter implements IRunnerResultStreamEvent {
    constructor(public readonly stderr: Readable, public readonly stdout: Readable) {
        super();
    }
}

interface IRunnerResultStreamEvent {
    on(event: 'finish', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
}
