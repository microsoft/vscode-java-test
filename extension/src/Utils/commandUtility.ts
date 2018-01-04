// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as util from 'util';
import { commands, Disposable } from 'vscode';

export class CommandUtility {
    public static getCommandWithArgs(command: string, args: any[]): string {
        if (!args) {
            return command;
        }
        const commandWithArgs: string = `${command}-args`;
        const exists: boolean = CommandUtility.proxiesHashes.has(commandWithArgs);

        if (exists) {
          CommandUtility.proxiesHashes.get(commandWithArgs).dispose();
        }
        const composite: Disposable = commands.registerCommand (commandWithArgs, () => {
            commands.executeCommand(command, ...args);
        });

        CommandUtility.proxiesHashes.set(commandWithArgs, composite);
        return commandWithArgs;
    }

    public static clearCommandsCache(): void {
        CommandUtility.proxiesHashes.forEach((c) => c.dispose());
        CommandUtility.proxiesHashes.clear();
    }
    private static readonly proxiesHashes: Map<string, Disposable> = new Map<string, Disposable>();
}
