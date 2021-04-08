// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as fse from 'fs-extra';
import { CancellationToken, Event, Uri, Extension, extensions, workspace, commands } from 'vscode';

interface IDisposable {
    dispose(): void;
}

namespace Disposible {
    // tslint:disable-next-line: no-empty typedef
    export const None: Event<any> = () => Object.freeze<IDisposable>({ dispose() { } });
}

export namespace Token {
    export const cancellationToken: CancellationToken = Object.freeze({
        isCancellationRequested: false,
        onCancellationRequested: Disposible.None,
    });
}

export namespace Uris {
    // JUnit
    const TEST_PROJECT_BASE_PATH: string = path.join(__dirname, '..', '..', 'test', 'test-projects');
    export const JUNIT4_TEST_PACKAGE: string = path.join('junit', 'src', 'test', 'java', 'junit4');
    export const JUNIT4_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'TestAnnotation.java'));
    export const JUNIT4_THEROY: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'TheoryAnnotation.java'));
    export const JUNIT4_RUNWITH: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'RunWithAnnotation.java'));
    export const JUNIT4_EXCEPTION_BEFORE: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'ExceptionInBefore.java'));
    export const JUNIT4_PARAMETERIZED_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'ParameterizedTest.java'));
    export const JUNIT4_PARAMETERIZED_WITH_NAME_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'ParameterizedWithNameTest.java'));
    export const JUNIT4_ASSUME_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT4_TEST_PACKAGE, 'AssumeTest.java'));

    // JUnit5
    const JUNIT5_TEST_PACKAGE: string = path.join('junit', 'src', 'test', 'java', 'junit5');
    export const JUNIT5_PARAMETERIZED_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT5_TEST_PACKAGE, 'ParameterizedAnnotationTest.java'));
    export const JUNIT5_NESTED_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT5_TEST_PACKAGE, 'NestedTest.java'));
    export const JUNIT5_META_ANNOTATION_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT5_TEST_PACKAGE, 'MetaAnnotationTest.java'));
    export const JUNIT5_PROPERTY_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT5_TEST_PACKAGE, 'PropertyTest.java'));
    export const CUCUMBER_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT5_TEST_PACKAGE, 'cucumber', 'CucumberTest.java'));
    export const CUCUMBER_STEP: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, JUNIT5_TEST_PACKAGE, 'cucumber', 'CucumberSteps.java'));

    // Gradle modular
    const MODULAR_GRADLE: string = path.join('modular-gradle', 'src', 'test', 'java', 'com', 'example', 'project');
    export const MODULAR_GRADLE_TEST: Uri = Uri.file(path.join(TEST_PROJECT_BASE_PATH, MODULAR_GRADLE, 'GradleModularTest.java'));
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

async function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function getJavaVersion(): Promise<number> {
    const extension: Extension<any> | undefined = extensions.getExtension('redhat.java');
    try {
        const extensionApi: any = await extension!.activate();
        if (extensionApi && extensionApi.javaRequirement) {
            return extensionApi.javaRequirement.java_version;
        }
    } catch (error) {
        // Swallow the error
    }

    return -1;
}
