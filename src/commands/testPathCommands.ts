// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { QuickPickItem, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import { testCodeLensProvider } from '../codeLensProvider';
import { testExplorer } from '../explorer/testExplorer';
import { testFileWatcher } from '../testFileWatcher';
import { getTestSourcePaths, updateTestClasspathEntries } from '../utils/commandUtils';

export async function updateTestSourcePaths(): Promise<void> {
    if (!workspace.workspaceFolders) {
        window.showInformationMessage('No workspace opened in VS Code.');
        return;
    }
    const sourcePaths: ITestSourcePath[] = await getTestSourcePaths(workspace.workspaceFolders.map((workspaceFolder: WorkspaceFolder) => workspaceFolder.uri.toString()));
    if (sourcePaths.length === 0) {
        window.showInformationMessage("No Java test source directories found in the workspace, please use the command 'Add Folder to Java Test Source Path' first.");
    } else {
        const selectedTestPaths: QuickPickItem[] | undefined = await window.showQuickPick(sourcePaths.map((sourcePath: ITestSourcePath) => {
            return {
                label: sourcePath.displayPath,
                detail: `$(file-directory) ${sourcePath.projectType} Project: ${sourcePath.projectName}`,
                description: sourcePath.path,
                picked: sourcePath.isTest,
            };
        }), { placeHolder: 'All Java test source directories recognized by the workspace.', canPickMany: true, ignoreFocusOut: true });
        if (!selectedTestPaths) {
            return;
        }
        const changedSourcePath: ITestSourcePath[] = getChangedSourcePath(sourcePaths, selectedTestPaths.map((item: QuickPickItem) => item.description!));
        if (changedSourcePath.length > 0) {
            const result: IResult | undefined = await updateTestClasspathEntries(changedSourcePath);
            if (result && result.status) {
                testCodeLensProvider.refresh();
                testExplorer.refresh();
                testFileWatcher.registerListeners();
                window.showInformationMessage('Successfully updated the test source path(s).');
            } else {
                window.showErrorMessage(`Failed to update the test source path(s). ${result ? result.message : ''}`);
            }
        }
    }
}

function getChangedSourcePath(origin: ITestSourcePath[], selected: string[]): ITestSourcePath[] {
    const res: ITestSourcePath[] = [];
    for (const originSourcePath of origin) {
        if (isInSelectedPath(originSourcePath, selected) && !originSourcePath.isTest) {
            res.push(updatePath(originSourcePath, true));
        } else if (!isInSelectedPath(originSourcePath, selected) && originSourcePath.isTest) {
            res.push(updatePath(originSourcePath, false));
        }
    }
    return res;
}

function isInSelectedPath(pathToSearch: ITestSourcePath, selected: string[]): boolean {
    for (const sourcePath of selected) {
        if (sourcePath === pathToSearch.path) {
            return true;
        }
    }
    return false;
}

function updatePath(sourcePath: ITestSourcePath, isTest: boolean): ITestSourcePath {
    sourcePath.path = Uri.file(sourcePath.path).toString();
    sourcePath.isTest = isTest;
    return sourcePath;
}

export interface ITestSourcePath {
    path: string;
    displayPath: string;
    isTest: boolean;
    projectName: string;
    projectType: string;
}

export interface IResult {
    status: boolean;
    message: string;
}
