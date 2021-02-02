// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Position, QuickPickItem, Range, Uri, ViewColumn, window } from 'vscode';
import { ILocation } from '../../extension.bundle';
import { JavaTestRunnerCommands } from '../constants/commands';
import { logger } from '../logger/logger';
import { resolveStackTraceLocation, searchTestLocation } from '../utils/commandUtils';

export async function openStackTrace(trace: string, fullName: string): Promise<void> {
    if (!trace || !fullName) {
        return;
    }

    const projectName: string = fullName.substring(0, fullName.indexOf('@'));

    const uri: string = await resolveStackTraceLocation(trace, projectName ? [projectName] : []);
    if (uri) {
        let lineNumber: number = 0;
        const lineNumberGroup: RegExpExecArray | null = /\((?:[\w-$]+\.java:(\d+))\)/.exec(trace);
        if (lineNumberGroup) {
            lineNumber = parseInt(lineNumberGroup[1], 10) - 1;
        }
        await window.showTextDocument(Uri.parse(uri), {
            selection: new Range(new Position(lineNumber, 0), new Position(lineNumber + 1, 0)),
            viewColumn: ViewColumn.One,
        });
    } else {
        const methodNameGroup: RegExpExecArray | null = /([\w$\.]+\/)?(([\w$]+\.)+[<\w$>]+)\(.*\)/.exec(trace);
        if (methodNameGroup) {
            const fullyQualifiedName: string = methodNameGroup[2].substring(0, methodNameGroup[2].lastIndexOf('.'));
            const className: string = fullyQualifiedName.substring(fullyQualifiedName.lastIndexOf('.') + 1);
            commands.executeCommand('workbench.action.quickOpen', '#' + className);
        }
    }
}

export async function openTestSourceLocation(uri: string, range: string, fullName: string): Promise<void> {
    if (uri && range) {
        return commands.executeCommand(JavaTestRunnerCommands.OPEN_DOCUMENT, Uri.parse(uri), JSON.parse(range) as Range);
    } else if (fullName) {
        const methodEndIndex: number = fullName.indexOf('[');
        const items: ILocation[] = await searchTestLocation(fullName.slice(fullName.indexOf('@') + 1, methodEndIndex < 0 ? undefined : methodEndIndex));
        if (items.length === 1) {
            return commands.executeCommand(JavaTestRunnerCommands.OPEN_DOCUMENT, Uri.parse(items[0].uri), items[0].range);
        } else if (items.length > 1) {
            const pick: ILocationQuickPick | undefined = await window.showQuickPick(items.map((item: ILocation) => {
                return { label: fullName, detail: Uri.parse(item.uri).fsPath, location: item };
            }), { placeHolder: 'Select the file you want to navigate to' });
            if (pick) {
                return commands.executeCommand(JavaTestRunnerCommands.OPEN_DOCUMENT, Uri.parse(pick.location.uri), pick.location.range);
            }
        } else {
            logger.error('No test item could be found from Language Server.');
        }
    } else {
        logger.error('Could not open the document, Neither the Uri nor full name is null.');
    }
}

interface ILocationQuickPick extends QuickPickItem {
    location: ILocation;
}
