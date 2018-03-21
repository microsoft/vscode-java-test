// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Configs from '../Constants/configs';
import * as Logger from './Logger/logger';

import * as archiver from 'archiver';
import * as fileUrl from 'file-url';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as os from 'os';
import * as path from 'path';

export class ClassPathUtility {
    public static getClassPathStr(
        classpaths: string[],
        separator: string,
        tmpStoragePath: string): Promise<string> {
        const concated = classpaths.join(separator);
        if (concated.length <= Configs.MAX_CLASS_PATH_LENGTH) {
            return Promise.resolve(concated);
        }
        return ClassPathUtility.generateClassPathFile(classpaths, tmpStoragePath);
    }

    /*
     * solve the issue that long class path cannot be processed by child process
     */
    private static generateClassPathFile(
        classpaths: string[],
        tmpStoragePath: string): Promise<string> {
        const tempFile = path.join(tmpStoragePath, 'path.jar');
        return new Promise((resolve, reject) => {
            mkdirp(path.dirname(tempFile), (err) => {
                if (err && err.code !== 'EEXIST') {
                    Logger.error(`Failed to create sub directory for this run. Storage path: ${err}`, {
                        error: err,
                    });
                    reject(err);
                }
                const output = fs.createWriteStream(tempFile);
                output.on('close', () => {
                    resolve(tempFile);
                });
                const jarfile = archiver('zip');
                jarfile.on('error', (jarErr) => {
                    Logger.error(`Failed to process too long class path issue. Error: ${err}`, {
                        error: err,
                    });
                    reject(jarErr);
                });
                // pipe archive data to the file
                jarfile.pipe(output);
                jarfile.append(this.constructManifestFile(classpaths), { name: 'META-INF/MANIFEST.MF' });
                jarfile.finalize();
            });
        });
    }

    private static constructManifestFile(classpaths: string[]): string {
        let content = '';
        const extended = ['Class-Path:', ...classpaths.map((c) => {
            const p = fileUrl(c);
            return p.endsWith('.jar') ? p : p + '/';
        })];
        content += extended.join(` ${os.EOL} `);
        content += os.EOL;
        return content;
    }
}
