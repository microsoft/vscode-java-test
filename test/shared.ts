// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { CancellationToken, Event, Uri } from 'vscode';

interface IDisposable {
    dispose(): void;
}

namespace Disposible {
    // tslint:disable-next-line: no-empty typedef
    export const None: Event<any> = () => Object.freeze<IDisposable>({ dispose() { } });
}

export namespace Token {
    export const cancellationToken: CancellationToken = Object.freeze({
        isCancellationRequested: false,
        onCancellationRequested: Disposible.None,
    });
}

export namespace Uris {
    // JUnit 4
    const TEST_PROJECT_BASE_PATH: string = path.join(__dirname, '..', '..', 'test', 'test-projects');
    const JUNIT4_TEST_PACKAGE: string = path.join('junit4', 'src', 'test', 'java', 'junit4');
    export const JUNIT4_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'TestAnnotation.java'));
    export const JUNIT4_THEROY: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'TheoryAnnotation.java'));
    export const JUNIT4_RUNWITH: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'RunWithAnnotation.java'));
}
