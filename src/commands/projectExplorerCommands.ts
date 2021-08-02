// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import { TestItem, TestRunRequest, Uri } from 'vscode';
import { sendError } from 'vscode-extension-telemetry-wrapper';
import { loadChildren, runTests, testController } from '../controller/testController';
import { loadJavaProjects, updateItemForDocument } from '../controller/utils';
import { IProgressReporter } from '../debugger.api';
import { progressProvider } from '../extension';
import { TestLevel } from '../types';

export async function runTestsFromJavaProjectExplorer(node: any, isDebug: boolean): Promise<void> {
    const testLevel: TestLevel = getTestLevel(node._nodeData);
    const isHierarchicalMode: boolean = isHierarchical(node._nodeData);
    const progressReporter: IProgressReporter | undefined = progressProvider?.createProgressReporter(isDebug ? 'Debug Test' : 'Run Test');
    progressReporter?.report('Searching tests...');
    const tests: TestItem[] = [];
    if (testLevel === TestLevel.Class) {
        tests.push(...await updateItemForDocument(node._nodeData.uri));
    } else if (testLevel === TestLevel.Package) {
        if (!testController?.items.size) {
            await loadJavaProjects();
        }
        const projectName: string = node._project.name;
        const projectItem: TestItem | undefined = testController!.items.get(projectName);
        if (!projectItem) {
            sendError(new Error('The project name of the node in java project explorer cannot be found in test explorer'));
            return;
        }
        await loadChildren(projectItem);
        const nodeFsPath: string = Uri.parse(node._nodeData.uri).fsPath;
        projectItem.children.forEach((child: TestItem) => {
            const itemPath: string = child.uri?.fsPath || '';
            if (isHierarchicalMode || node._nodeData.kind === 4 /*packageRoot*/) {
                // if the selected node is a package root or the view is in hierarchical mode,
                // all the test items whose path start from the path of the selected node will be added
                if (itemPath.startsWith(nodeFsPath)) {
                    tests.push(child);
                }
            } else {
                // in flat mode, we require the paths exact match
                if (path.relative(itemPath, nodeFsPath) === '') {
                    tests.push(child);
                }
            }
        });
    }

    const request: TestRunRequest = new TestRunRequest(tests, undefined);

    await runTests(request, { progressReporter, isDebug });
}

function getTestLevel(nodeData: any): TestLevel {
    // The command will only register on the class/package/packageRoot
    // nodes of the Java Project explorer
    if (nodeData.kind === 6 /*PrimaryType*/) {
        return TestLevel.Class;
    } else {
        return TestLevel.Package;
    }
}

function isHierarchical(nodeData: any): boolean {
    return !!nodeData.isPackage;
}
