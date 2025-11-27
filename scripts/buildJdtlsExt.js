// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fse = require('fs-extra');

fse.removeSync('server');
const serverDir = path.resolve('java-extension');
const bundleList = [
    'org.eclipse.jdt.junit4.runtime_',
    'org.eclipse.jdt.junit5.runtime_',
    'org.eclipse.jdt.junit6.runtime_',
    'junit-jupiter-api',
    'junit-jupiter-engine',
    'junit-jupiter-migrationsupport',
    'junit-jupiter-params',
    'junit-vintage-engine',
    'org.opentest4j',
    'junit-platform-commons',
    'junit-platform-engine',
    'junit-platform-launcher',
    'junit-platform-runner',
    'junit-platform-suite-api',
    'junit-platform-suite-commons',
    'junit-platform-suite-engine',
    'org.apiguardian.api',
    'org.eclipse.jdt.junit.core_',
    'org.eclipse.jdt.junit.runtime_',
    'org.jacoco.core'
];
// Set MAVEN_OPTS to disable XML entity size limits for JDK XML parser
const env = { ...process.env };
env.MAVEN_OPTS = (env.MAVEN_OPTS || '') + ' -Djdk.xml.maxGeneralEntitySizeLimit=0 -Djdk.xml.totalEntitySizeLimit=0 -DentityExpansionLimit=0';
cp.execSync(`${mvnw()} clean verify`, { cwd: serverDir, stdio: [0, 1, 2], env });
copy(path.join(serverDir, 'com.microsoft.java.test.plugin/target'), path.resolve('server'), (file) => path.extname(file) === '.jar');
copy(path.join(serverDir, 'com.microsoft.java.test.runner/target'), path.resolve('server'), (file) => file.endsWith('jar-with-dependencies.jar'));
copy(path.join(serverDir, 'com.microsoft.java.test.plugin.site/target/repository/plugins'), path.resolve('server'), (file) => {
    return bundleList.some(bundleName => file.startsWith(bundleName));
});
updateVersion();
downloadJacocoAgent();

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
        const newExtensions = [];
        const processedBaseNames = new Set();
        
        for (const extensionString of javaExtensions) {
            const ind = extensionString.indexOf('_');
            if (ind >= 0) {
                const baseName = extensionString.substring(extensionString.lastIndexOf('/') + 1, ind);
                const pathPrefix = extensionString.substring(0, extensionString.lastIndexOf('/') + 1);
                
                // Check if we've already processed this base name
                if (!processedBaseNames.has(baseName)) {
                    processedBaseNames.add(baseName);
                    
                    // Find all jar files matching this base name
                    const matchingJars = findAllMatchingJars(baseName);
                    
                    // Add all matching jars to the new extensions list
                    for (const jar of matchingJars) {
                        newExtensions.push(pathPrefix + jar);
                    }
                }
            } else {
                // Keep non-versioned entries as is
                newExtensions.push(extensionString);
            }
        }

        packageJsonData.contributes.javaExtensions = newExtensions;
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

// Find all jar files matching the base name (supports multiple versions)
function findAllMatchingJars(baseName) {
    const prefix = baseName + "_";
    const destFolder = path.resolve('./server');
    const files = fs.readdirSync(destFolder);
    const matchingFiles = files.filter((file) => {
        return file.startsWith(prefix) && file.endsWith('.jar');
    });
    // Sort to ensure consistent order (helps with version ordering)
    return matchingFiles.sort();
}

function downloadJacocoAgent() {
    const version = "0.8.14";
    const jacocoAgentUrl = `https://repo1.maven.org/maven2/org/jacoco/org.jacoco.agent/${version}/org.jacoco.agent-${version}-runtime.jar`;
    const jacocoAgentPath = path.resolve('server', 'jacocoagent.jar');
    if (!fs.existsSync(jacocoAgentPath)) {
        cp.execSync(`curl -L ${jacocoAgentUrl} -o ${jacocoAgentPath}`);
    }
    if (!fs.existsSync(jacocoAgentPath)) {
        throw new Error('Failed to download jacoco agent.');
    }
}

function isWin() {
    return /^win/.test(process.platform);
}

function mvnw() {
    return isWin() ? 'mvnw.cmd' : './mvnw';
}