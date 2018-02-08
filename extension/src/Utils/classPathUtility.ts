// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Logger } from '../logger';
import * as Configs from '../Constants/configs';

import * as archiver from 'archiver';
import * as fileUrl from 'file-url';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as os from 'os';
import * as path from 'path';

export class ClassPathUtility {
    // TODO: refactor logger, no need to pass in logger instance.
    public static getClassPathStr(
        transactionId: string,
        logger: Logger,
        classpaths: string[],
        separator: string,
        tmpStoragePath: string): Promise<string> {
        const concated = classpaths.join(separator);
        if (concated.length <= Configs.MAX_CLASS_PATH_LENGTH) {
            return Promise.resolve(concated);
        }
        return ClassPathUtility.generateClassPathFile(transactionId, logger, classpaths, tmpStoragePath);
    }

    /*
     * solve the issue that long class path cannot be processed by child process
     */
    private static generateClassPathFile(
        transactionId: string,
        logger: Logger,
        classpaths: string[],
        tmpStoragePath: string): Promise<string> {
        const tempFile = path.join(tmpStoragePath, 'path.jar');
        return new Promise((resolve, reject) => {
            mkdirp(path.dirname(tempFile), (err) => {
                if (err && err.code !== 'EEXIST') {
                    logger.logError(`Failed to create sub directory for this run. Storage path: ${err}`, err, transactionId);
                    reject(err);
                }
                const output = fs.createWriteStream(tempFile);
                output.on('close', () => {
                    resolve(tempFile);
                });
                const jarfile = archiver('zip');
                jarfile.on('error', (jarErr) => {
                    logger.logError(`Failed to process too long class path issue. Error: ${err}`, err, transactionId);
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
        let content = "";
        const extended = ["Class-Path:", ...classpaths.map((c) => {
            const p = fileUrl(c);
            return p.endsWith('.jar') ? p : p + '/';
        })];
        content += extended.join(` ${os.EOL} `);
        content += os.EOL;
        return content;
    }
}
