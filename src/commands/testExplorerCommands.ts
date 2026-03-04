// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DebugConfiguration, TestItem, TestRunRequest, Uri } from 'vscode';
import { sendInfo } from 'vscode-extension-telemetry-wrapper';
import { loadChildren, runTests, testController } from '../controller/testController';
import { loadJavaProjects } from '../controller/utils';
import { showTestItemsInCurrentFile } from '../extension';

/**
 * This function is used to exposed as a command, which other extensions can trigger
 * their customized run/debug requests to test runner. (e.g. the PDE extension)
 *
 * Note that, the test item in the method parameters is not the exact test item in the test explorer (another instance).
 * To get the metadata of the real test item, we have to record the path from test item to root, and then trace back that
 * path to get the real one.
 */
export async function runTestsFromTestExplorer(testItem: TestItem, launchConfiguration: DebugConfiguration, isDebug: boolean): Promise<void> {
    const pathToRoot: string[] = [];
    do {
        pathToRoot.push(testItem.id);
        testItem = testItem.parent!;
    } while (testItem);
    let currentItem: TestItem | undefined = testController?.items.get(pathToRoot.pop()!);
    if (!currentItem) {
        return;
    }
    while (pathToRoot.length) {
        const id: string = pathToRoot.pop()!;
        currentItem = currentItem.children.get(id);
        if (!currentItem) {
            return;
        }
    }
    const request: TestRunRequest = new TestRunRequest([currentItem], undefined);

    await runTests(request, { launchConfiguration, isDebug });
}

export async function refreshExplorer(): Promise<void> {
    sendInfo('', { name: 'refreshTests' });

    await loadJavaProjects();

    // Force re-resolution of all existing project roots
    const loadPromises: Promise<void>[] = [];
    testController?.items.forEach((root: TestItem) => {
        loadPromises.push(loadChildren(root));
    });
    await Promise.all(loadPromises);

    await showTestItemsInCurrentFile();
}

/**
 * Ensure the URI string ends with '/' so that startsWith comparisons
 * are path-segment-aware (e.g. ".../app/" won't prefix-match ".../app2/").
 */
function ensureTrailingSeparator(uriString: string): string {
    return uriString.endsWith('/') ? uriString : uriString + '/';
}/**
 * Refresh only the project subtree that matches the given classpath-change URI.
 * If the URI is an ancestor of known test projects, refreshes all matching children.
 * If the URI doesn't correspond to any known test project, the refresh is skipped
 * to avoid unnecessary full reloads (e.g. for non-test projects like Gradle's buildSrc).
 */
export async function refreshProject(classpathUri: Uri): Promise<void> {
    sendInfo('', { name: 'refreshProject' });
    const uriString: string = ensureTrailingSeparator(classpathUri.toString());

    // Find the project root with the longest matching URI prefix (most specific match),
    // or find a project whose URI is a child of the classpath URI (e.g. workspace root changed).
    // All comparisons use separator-terminated URIs to avoid false positives
    // (e.g. "file:///ws/app" must not match "file:///ws/app2").
    let matchedProject: TestItem | undefined;
    let matchedUriLength: number = 0;
    let childProjectMatched: boolean = false;
    testController?.items.forEach((root: TestItem) => {
        if (root.uri) {
            const rootUriString: string = ensureTrailingSeparator(root.uri.toString());
            if (uriString.startsWith(rootUriString) && rootUriString.length > matchedUriLength) {
                matchedProject = root;
                matchedUriLength = rootUriString.length;
            } else if (rootUriString.startsWith(uriString)) {
                // The classpath URI is an ancestor of this project (e.g. workspace root)
                childProjectMatched = true;
            }
        }
    });

    if (matchedProject) {
        // Re-resolve only the matched project's children
        await loadChildren(matchedProject);
    } else if (childProjectMatched) {
        // The classpath URI is an ancestor containing test projects – refresh all children
        const loadPromises: Promise<void>[] = [];
        testController?.items.forEach((root: TestItem) => {
            if (root.uri && ensureTrailingSeparator(root.uri.toString()).startsWith(uriString)) {
                loadPromises.push(loadChildren(root));
            }
        });
        await Promise.all(loadPromises);
    } else {
        // URI doesn't match any known test project – skip to avoid unnecessary full refresh
        return;
    }
    await showTestItemsInCurrentFile();
}
