// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, Progress, ProgressLocation, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as fse from 'fs-extra';
import * as _ from 'lodash';
import * as os from 'os';
import { getJavaProjects, getProjectType } from '../controller/utils';
import { IJavaTestItem, ProjectType, TestKind } from '../types';
import { createWriteStream, WriteStream } from 'fs';
import { URL } from 'url';
import { ClientRequest, IncomingMessage } from 'http';
import { sendError } from 'vscode-extension-telemetry-wrapper';

export async function enableTests(testKind?: TestKind): Promise<void> {
    const project: IJavaTestItem | undefined = await getTargetProject();
    if (!project) {
        return;
    }

    const projectType: ProjectType = await getProjectType(project);
    switch (projectType) {
        case ProjectType.UnmanagedFolder:
            await setupUnmanagedFolder(Uri.parse(project.uri!), testKind);
            return;
        default:
            // currently other typed projects are not supported.
            break;
    }
    return;
}

async function getTargetProject(): Promise<IJavaTestItem | undefined> {
    let testProjects: IJavaTestItem[] = [];
    for (const workspaceFolder of workspace.workspaceFolders || [] ) {
        testProjects.push(...await getJavaProjects(workspaceFolder));
    }

    testProjects = testProjects.filter((project: IJavaTestItem) => {
        return project.testKind === TestKind.None;
    });

    if (testProjects.length === 0) {
        sendError(new Error('Failed to find a project to enable tests.'));
        return undefined;
    }

    // currently this feature will only be enabled when workspace contains one unmanaged folder without test dependencies.
    return testProjects[0];
}

async function setupUnmanagedFolder(projectUri: Uri, testKind?: TestKind): Promise<void> {
    testKind ??= await getTestKind();
    if (testKind === undefined) {
        return;
    }
    const libFolder: string = await getLibFolder(projectUri);
    const libFolderExists: boolean = await fse.pathExists(libFolder);
    if (!libFolderExists) {
        await fse.ensureDir(libFolder);
    }

    try {
        await window.withProgress({
            location: ProgressLocation.Notification,
            cancellable: true
        }, async (progress: Progress<{message?: string; increment?: number}>, token: CancellationToken) => {
            const metadata: IArtifactMetadata[] = getJarIds(testKind!);
            for (const jar of metadata) {
                if (token.isCancellationRequested) {
                    throw new Error('User cancelled');
                }
                progress.report({
                    message: `Downloading ${jar.artifactId}.jar...`,
                });
                if (!jar.version) {
                    jar.version = await getLatestVersion(jar.groupId, jar.artifactId) || jar.defaultVersion;
                }
                await downloadJar(libFolder, jar.groupId, jar.artifactId, jar.version, metadata.length, progress, token);
            }
        });
    } catch (e) {
        if (e?.message !== 'User cancelled') {
            sendError(e);
        }
        if (!libFolderExists) {
            fse.remove(libFolder);
        }
        return;
    }

    updateProjectSettings(projectUri, libFolder);
}

async function getTestKind(): Promise<TestKind | undefined> {
    const framework: any = await window.showQuickPick([{
        label: 'JUnit Jupiter',
        value: TestKind.JUnit5,
    }, {
        label: 'JUnit',
        value: TestKind.JUnit,
    }, {
        label: 'TestNG',
        value: TestKind.TestNG,
    }], {
        placeHolder: 'Select the test framework to be enabled.'
    });
    return framework?.value;
}

async function getLibFolder(projectUri: Uri): Promise<string> {
    const referencedLibraries: any = workspace.getConfiguration('java', projectUri).get('project.referencedLibraries');
    if (_.isArray(referencedLibraries)) {
        // do a simple check if the project uses default lib location.
        if (referencedLibraries.includes('lib/**/*.jar')) {
            return path.join(projectUri.fsPath, 'lib');
        }
    }

    for (let i: number = 0; i < 100; i++) {
        const folderPath: string = path.join(projectUri.fsPath, `test-lib${i > 0 ? i : ''}`);
        if (await fse.pathExists(folderPath)) {
            continue;
        }
        return folderPath;
    }

    return path.join(projectUri.fsPath, 'test-lib');
}

function getJarIds(testKind: TestKind): IArtifactMetadata[] {
    switch (testKind) {
        case TestKind.JUnit5:
            return [{
                groupId: 'org.junit.platform',
                artifactId: 'junit-platform-console-standalone',
                defaultVersion: '1.8.2',
            }];
        case TestKind.JUnit:
            return [{
                groupId: 'junit',
                artifactId: 'junit',
                defaultVersion: '4.13.2',
            }, {
                groupId: 'org.hamcrest',
                artifactId: 'hamcrest-core',
                version: '1.3',
                defaultVersion: '1.3',
            }];
        case TestKind.TestNG:
            return [{
                groupId: 'org.testng',
                artifactId: 'testng',
                defaultVersion: '7.5',
            }, {
                groupId: 'com.beust',
                artifactId: 'jcommander',
                defaultVersion: '1.82',
            }, {
                groupId: 'org.slf4j',
                artifactId: 'slf4j-api',
                defaultVersion: '1.7.35',
            }];
        default:
            return [];
    }
}

async function getLatestVersion(groupId: string, artifactId: string): Promise<string | undefined> {
    try {
        const response: any = await getHttpsAsJSON(getQueryLink(groupId, artifactId));

        if (!response.response?.docs?.[0]?.latestVersion) {
            sendError(new Error(`Invalid format for the latest version response`));
            return undefined;
        }
        return response.response.docs[0].latestVersion;
    } catch (e) {
        sendError(new Error(`Failed to fetch the latest version for ${groupId}:${artifactId}`));
    }

    return undefined;
}

async function downloadJar(
    libFolder: string,
    groupId: string,
    artifactId: string,
    version: string,
    totalJars: number,
    progress: Progress<{message?: string; increment?: number}>,
    token: CancellationToken
    ): Promise<void> {
    // tslint:disable-next-line: typedef
    await new Promise<void>(async (resolve, reject) => {
        progress.report({
            message: `Downloading ${artifactId}-${version}.jar...`,
        });
        const tempFilePath: string = path.join(os.tmpdir(), `${artifactId}-${version}.jar`);
        const writer: WriteStream = createWriteStream(tempFilePath);

        const url: string = getDownloadLink(groupId, artifactId, version);
        const totalSize: number = await getTotalBytes(url);
        if (token.isCancellationRequested) {
            writer.close();
            return reject(new Error('User cancelled'));
        }
        const req: ClientRequest = https.get(url, (res: IncomingMessage) => {
            res.pipe(writer);
            res.on('data', (chunk: any) => {
                progress.report({
                    message: `Downloading ${artifactId}-${version}.jar...`,
                    increment: chunk.length / totalSize / totalJars * 100,
                });
            });
        });

        token.onCancellationRequested(() => {
            req.destroy();
            writer.close();
            fse.unlink(tempFilePath);
            reject(new Error('User cancelled'));
        });

        req.on('error', (err: any) => {
            writer.close();
            fse.unlink(tempFilePath);
            reject(err);
        });

        writer.on('finish', () => {
            writer.close();
            const filePath: string = path.join(libFolder, `${artifactId}-${version}.jar`);
            fse.move(tempFilePath, filePath, { overwrite: false });
            return resolve();
        });

        writer.on('error', () => {
            writer.close();
            fse.unlink(tempFilePath);
            reject(new Error('Failed to write jar file.'));
        });
    });
}

async function updateProjectSettings(projectUri: Uri, libFolder: string): Promise<void> {
    // if 'referenced libraries' is already set to 'lib/**/*.jar'
    if (path.basename(libFolder) === 'lib') {
        window.showInformationMessage("Test libraries have been downloaded into 'lib/'.");
        return;
    }

    const relativePath: string = path.relative(projectUri.fsPath, libFolder);
    const testDependencies: string = path.join(relativePath, '**', '*.jar');
    const configuration: WorkspaceConfiguration = workspace.getConfiguration('java', projectUri);
    let referencedLibraries: any = configuration.get('project.referencedLibraries');
    if (_.isArray(referencedLibraries)) {
        referencedLibraries.push(testDependencies);
        referencedLibraries = Array.from(new Set(referencedLibraries));
    } else if (_.isObject(referencedLibraries)) {
        referencedLibraries = referencedLibraries as {include: string[]};
        referencedLibraries.include.push(testDependencies);
        referencedLibraries.include = Array.from(new Set(referencedLibraries.include));
        if (!referencedLibraries.exclude && !referencedLibraries.sources) {
            referencedLibraries = referencedLibraries.include;
        }
    }

    configuration.update('project.referencedLibraries', referencedLibraries);
    window.showInformationMessage(`Test libraries have been downloaded into '${relativePath}/'.`);
}

async function getHttpsAsJSON(link: string): Promise<any> {
    // tslint:disable-next-line: typedef
    const response: string = await new Promise<string>((resolve, reject) => {
        let result: string = '';
        https.get(link, {
            headers: {
                'User-Agent': 'vscode-JavaTestRunner/0.1',
            },
        }, (res: http.IncomingMessage) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Request failed with status code: ${res.statusCode}`));
            }
            res.on('data', (chunk: any) => {
                result = result.concat(chunk.toString());
            });
            res.on('end', () => {
                resolve(result);
            });
            res.on('error', reject);
        });
    });
    return JSON.parse(response);
}

async function getTotalBytes(url: string): Promise<number> {
  // tslint:disable-next-line: typedef
  return new Promise<number>((resolve, reject) => {
    const link: URL = new URL(url);
    const req: ClientRequest = https.request({
      host: link.host,
      path: link.pathname,
      method: 'HEAD'
    }, (res: http.IncomingMessage) => {
      const num: number = parseInt(res.headers['content-length'] as string, 10);
      resolve(num);
    });
    req.on('error', reject);
    req.end();
  });
}

function getQueryLink(groupId: string, artifactId: string): string {
    return `https://search.maven.org/solrsearch/select?q=id:%22${groupId}:${artifactId}%22&rows=1&wt=json`;
}

function getDownloadLink(groupId: string, artifactId: string, version: string): string {
    return `https://repo1.maven.org/maven2/${groupId.split('.').join('/')}/${artifactId}/${version}/${artifactId}-${version}.jar`
}

interface IArtifactMetadata {
    groupId: string;
    artifactId: string;
    version?: string;
    defaultVersion: string;
}
