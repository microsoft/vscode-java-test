// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fse = require('fs-extra');

const serverDir = path.resolve('java-extension');
const bundleList = [
    'org.eclipse.jdt.junit4.runtime_',
    'org.eclipse.jdt.junit5.runtime_',
    'org.junit.jupiter.api',
    'org.junit.jupiter.engine',
    'org.junit.jupiter.migrationsupport',
    'org.junit.jupiter.params',
    'org.junit.vintage.engine',
    'org.opentest4j',
    'org.junit.platform.commons',
    'org.junit.platform.engine',
    'org.junit.platform.launcher',
    'org.junit.platform.runner',
    'org.junit.platform.suite.api',
    'org.apiguardian',
];
cp.execSync(`${mvnw()} clean verify`, { cwd: serverDir, stdio: [0, 1, 2] });
copy(path.join(serverDir, 'com.microsoft.java.test.plugin/target'), path.resolve('server'), (file) => path.extname(file) === '.jar');
copy(path.join(serverDir, 'com.microsoft.java.test.runner/target'), path.resolve('server'), (file) => file.endsWith('jar-with-dependencies.jar'));
copy(path.join(serverDir, 'com.microsoft.java.test.plugin.site/target/repository/plugins'), path.resolve('server'), (file) => {
    return bundleList.some(bundleName => file.startsWith(bundleName));
});
updateVersion();

function copy(sourceFolder, targetFolder, fileFilter) {
    const jars = fse.readdirSync(sourceFolder).filter(file => fileFilter(file));
    fse.ensureDirSync(targetFolder);
    for (const jar of jars) {
        fse.copyFileSync(path.join(sourceFolder, jar), path.join(targetFolder, path.basename(jar)));
    }
}

function updateVersion() {
    // Update the version
    const packageJsonData = require('../package.json');
    const javaExtensions = packageJsonData.contributes.javaExtensions;
    if (Array.isArray(javaExtensions)) {
        packageJsonData.contributes.javaExtensions  = javaExtensions.map((extensionString) => {
            const ind = extensionString.indexOf('_');
            const fileName = findNewRequiredJar(extensionString.substring(extensionString.lastIndexOf('/') + 1, ind));
            if (ind >= 0) {
                return extensionString.substring(0, extensionString.lastIndexOf('/') + 1) + fileName;
            }
            return extensionString;
        });

        fs.writeFileSync(path.resolve('package.json'), JSON.stringify(packageJsonData, null, 4));
        fs.appendFileSync(path.resolve('package.json'), os.EOL);
    }
}

// The plugin jar follows the name convention: <name>_<version>.jar
function findNewRequiredJar(fileName) {
    fileName = fileName + "_";
    const destFolder = path.resolve('./server');
    const files = fs.readdirSync(destFolder);
    const f = files.find((file) => {
        return file.indexOf(fileName) >= 0;
    });
    return f;
}

function isWin() {
    return /^win/.test(process.platform);
}

function mvnw() {
    return isWin() ? 'mvnw.cmd' : './mvnw';
}