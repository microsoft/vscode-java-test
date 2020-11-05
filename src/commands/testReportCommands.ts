// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, Position, Range, Uri, window } from 'vscode';
import { resolveStackTraceLocation } from '../utils/commandUtils';

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
            preserveFocus: true,
            selection: new Range(new Position(lineNumber, 0), new Position(lineNumber + 1, 0)),
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
