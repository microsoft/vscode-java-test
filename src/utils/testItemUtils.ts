// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestIdParts } from '../java-test-runner.api';

export function parseTestIdFromParts(parts: TestIdParts): string {
    let testId: string = parts.project;
    if (parts.class) {
        testId += `@${parts.class}`;
    } else if (parts.package) {
        testId += `@${parts.package}`;
    }

    if (parts.invocations?.length) {
        testId += `#${parts.invocations.join('#')}`;
    }

    return testId;
}

export function parsePartsFromTestId(testId: string): TestIdParts {
    const idxOfProjectSeparator: number = testId.indexOf('@');
    if (idxOfProjectSeparator < 0) {
        return { project: testId };
    }

    const project: string = testId.substring(0, idxOfProjectSeparator);
    testId = testId.substring(idxOfProjectSeparator + 1);

    const idxOfMethodStart: number = testId.indexOf('#');
    let classFullyQualifiedName: string;
    if (idxOfMethodStart > 0) {
        classFullyQualifiedName = testId.substring(0, idxOfMethodStart);
    } else {
        classFullyQualifiedName = testId;
    }

    const idxOfLastDot: number = classFullyQualifiedName.lastIndexOf('.');
    const packageName: string = idxOfLastDot > 0 ? classFullyQualifiedName.substring(0, idxOfLastDot) : '';

    let invocations: string[] | undefined;
    if (idxOfMethodStart > 0) {
        testId = testId.substring(idxOfMethodStart + 1);
        invocations = [...testId.split('#')];
    }

    return {
        project,
        package: packageName,
        class: classFullyQualifiedName,
        invocations,
    }
}
