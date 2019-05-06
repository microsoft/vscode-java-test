// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { workspace, window, WorkspaceFolder } from "vscode";
import { getTestSourcePaths } from "../utils/commandUtils";

export async function listTestSourcePaths(): Promise<void> {
    if (!workspace.workspaceFolders) {
        window.showInformationMessage("No workspace opened in VS Code.");
        return;
    }
    const sourcePaths: ITestSourcePath[] = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
    if (sourcePaths.length === 0) {
        window.showInformationMessage("No Java test source directories found in the workspace, please use the command 'Add Folder to Java Test Source Path' first.");
    } else {
        window.showQuickPick(sourcePaths.map(sourcePath => {
            return {
                label: sourcePath.path,
                detail: `$(file-directory) ${sourcePath.projectType} Project: ${sourcePath.projectName}`,
            };
        }), { placeHolder: 'All Java source directories recognized by the workspace.'});
    }
}

export interface ITestSourcePath {
    path: string;
    projectName: string;
    projectType: string;
}