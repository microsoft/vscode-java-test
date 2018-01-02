// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as util from 'util';
import { commands } from 'vscode';

export class CommandUtility {
    public static get(command: string, args: any[]) {
        if (!args) {
            return command;
        }

        const hash = `${command}${util.inspect(args)}`;
        const exists = !!CommandUtility.proxiesHashes.find((h) => h === hash);

        if (exists) {
          return hash;
        }
        commands.registerCommand (hash, () => {
            commands.executeCommand(command, ...args);
        });

        CommandUtility.proxiesHashes.push (hash);
        return hash;
    }
    private static readonly proxiesHashes: string[] = [];
}
