// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as archiver from 'archiver';
import * as fileUrl from 'file-url';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { MAX_CLASS_PATH_LENGTH } from '../constants/configs';
import { isDarwin, isLinux } from './platformUtils';

export async function getClassPathString(classpaths: string[], storagePath: string): Promise<string> {
    const separator: string = (isDarwin() || isLinux()) ? ':' : ';';
    const joinedClassPath: string = classpaths.join(separator);
    if (joinedClassPath.length <= MAX_CLASS_PATH_LENGTH) {
        return joinedClassPath;
    }
    return await generateClassPathFile(classpaths, storagePath);
}

async function generateClassPathFile(classpaths: string[], storagePath: string): Promise<string> {
    const classpathJarFilePath: string = path.join(storagePath, 'path.jar');
    await fse.ensureDir(path.dirname(classpathJarFilePath));
    return new Promise<string>((resolve: (value: string) => void, reject: (reason: any) => void): void => {
        const tempArchive: archiver.Archiver = archiver('zip');
        const writeStream: fse.WriteStream = fse.createWriteStream(classpathJarFilePath);
        tempArchive.pipe(writeStream);
        tempArchive.append(generateManifestFileContent(classpaths), { name: 'META-INF/MANIFEST.MF' });
        tempArchive.finalize();
        tempArchive.on('error', (error: archiver.ArchiverError) => {
            reject(error);
        });
        writeStream.on('close', () => {
            resolve(classpathJarFilePath);
        });
    });
}

function generateManifestFileContent(classpaths: string[]): string {
    const extended: string[] = ['Class-Path:', ...classpaths.map((classpath: string) => {
        const entry: string = fileUrl(classpath);
        return entry.endsWith('.jar') ? entry : entry + '/';
    })];
    return `${extended.join(` ${os.EOL} `)}${os.EOL}`;
}
