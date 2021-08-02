// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Location, Uri } from 'vscode';
import { JavaTestRunnerCommands } from '../constants';
import { asRange } from '../controller/utils';
import { executeJavaLanguageServerCommand } from '../utils/commandUtils';

export async function findTestLocation(fullName: string): Promise<Location | undefined> {
    const location: any | undefined = await executeJavaLanguageServerCommand<any>(
        JavaTestRunnerCommands.FIND_TEST_LOCATION, fullName);
    if (location) {
        return new Location(Uri.parse(location.uri), asRange(location.range)!);
    }

    return undefined;
}
