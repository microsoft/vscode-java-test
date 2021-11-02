// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as fse from 'fs-extra';
import * as path from 'path';
import { TestController, TestItem, Uri, Range, extensions, commands, workspace } from "vscode";
import { dataCache } from "../../src/controller/testItemDataCache";
import { TestKind, TestLevel } from "../../src/types";

export function generateTestItem(testController: TestController, id: string, testKind: TestKind, jdtHandler?: string): TestItem {
    if (!id) {
        throw new Error('id cannot be null');
    }

    const projectName = id.substring(0, id.indexOf('@'));
    const fullName = id.substring(id.indexOf('@') + 1);
    const label = id.substring(id.indexOf('#') + 1);

    const testItem = testController.createTestItem(id, label, Uri.file('/mock/test/TestAnnotation.java'));
    testItem.range = new Range(0, 0, 0, 0);
    dataCache.set(testItem, {
        jdtHandler: jdtHandler || '',
        fullName,
        projectName,
        testLevel: TestLevel.Method,
        testKind,
    });

    return testItem;
}

export async function setupTestEnv() {
    await extensions.getExtension("redhat.java")!.activate();
    const javaExt = extensions.getExtension("redhat.java");
    await javaExt!.activate();
    const api = javaExt?.exports;
    while (api.serverMode !== "Standard") {
        await sleep(2 * 1000/*ms*/);
    }
    await extensions.getExtension("vscjava.vscode-java-test")!.activate();

    const workspaceRootPath: string = workspace.workspaceFolders![0]!.uri.fsPath;
    if (await fse.pathExists(path.join(workspaceRootPath, 'pom.xml'))) {
        await commands.executeCommand('java.projectConfiguration.update', Uri.file(path.join(workspaceRootPath, 'pom.xml')));
    } else if (await fse.pathExists(path.join(workspaceRootPath, 'build.gradle'))) {
        await commands.executeCommand('java.projectConfiguration.update', Uri.file(path.join(workspaceRootPath, 'build.gradle')));
    }
}

export async function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
