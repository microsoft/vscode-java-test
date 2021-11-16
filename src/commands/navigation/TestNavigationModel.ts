// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Uri, Position, Location } from 'vscode';
import { SymbolItemNavigation } from '../../references-view';
import { ITestNavigationItem } from './navigationCommands';

export class TestNavigationModel implements SymbolItemNavigation<ITestNavigationItem> {
    nearest(): ITestNavigationItem | undefined {
        return undefined
    }

    next(from: ITestNavigationItem): ITestNavigationItem {
        return from;
    }

    previous(from: ITestNavigationItem): ITestNavigationItem {
        return from;
    }

    location(item: ITestNavigationItem): Location | undefined {
        return new Location(Uri.file(item.uri), new Position(0, 0));
    }
}
