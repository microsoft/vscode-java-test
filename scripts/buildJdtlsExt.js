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
    'org.eclipse.jdt.junit.core_',
    'org.eclipse.jdt.junit.runtime_',
    'org.eclipse.core.resources_',
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
    'org.jacoco.core'
];
cp.execSync(`${mvnw()} clean verify`, { cwd: serverDir, stdio: [0, 1, 2] });
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

// Helper function to select the JAR version(s) for javaExtensions (OSGi bundles)
// Returns both JUnit 5 (5.x/1.x) and JUnit 6 (6.x) versions for components that need both
// This is required because org.eclipse.jdt.junit5.runtime requires 5.x and 
// org.eclipse.jdt.junit6.runtime requires 6.x
function selectJarVersions(files, baseName) {
    const matchingFiles = files.filter(file => file.startsWith(baseName + '_'));
    if (matchingFiles.length === 0) {
        return [];
    }
    
    // Pattern to match version numbers
    const junit5Pattern = new RegExp(`^${baseName}_(5\\.\\d+\\.\\d+)\\.jar$`);
    const junit6Pattern = new RegExp(`^${baseName}_(6\\.\\d+\\.\\d+)\\.jar$`);
    const platform1Pattern = new RegExp(`^${baseName}_(1\\.\\d+\\.\\d+)\\.jar$`);
    
    // Components that need both JUnit 5 and JUnit 6 versions
    const needsBothVersions = [
        'junit-jupiter-api',
        'junit-jupiter-engine',
        'junit-jupiter-params',
        'junit-platform-commons',
        'junit-platform-engine',
        'junit-platform-launcher',
        'junit-platform-suite-api',
        'junit-platform-suite-engine'
    ];
    
    if (needsBothVersions.includes(baseName)) {
        const result = [];
        // Add 5.x version if exists (for junit-jupiter-*)
        const version5Files = matchingFiles.filter(file => junit5Pattern.test(file));
        if (version5Files.length > 0) {
            result.push(version5Files.sort().reverse()[0]);
        }
        // Add 1.x version if exists (for junit-platform-*)
        const version1Files = matchingFiles.filter(file => platform1Pattern.test(file));
        if (version1Files.length > 0) {
            result.push(version1Files.sort().reverse()[0]);
        }
        // Add 6.x version if exists
        const version6Files = matchingFiles.filter(file => junit6Pattern.test(file));
        if (version6Files.length > 0) {
            result.push(version6Files.sort().reverse()[0]);
        }
        // Remove duplicates and return
        return [...new Set(result)];
    }
    
    // For junit-vintage-engine, only use 5.x
    if (baseName === 'junit-vintage-engine') {
        const version5Files = matchingFiles.filter(file => junit5Pattern.test(file));
        if (version5Files.length > 0) {
            return [version5Files.sort().reverse()[0]];
        }
    }
    
    // For junit-jupiter-migrationsupport, only use 5.x (no 6.x version exists)
    if (baseName === 'junit-jupiter-migrationsupport') {
        const version5Files = matchingFiles.filter(file => junit5Pattern.test(file));
        if (version5Files.length > 0) {
            return [version5Files.sort().reverse()[0]];
        }
    }
    
    // For platform-runner and suite-commons, use 1.x version only
    if (baseName === 'junit-platform-runner' || baseName === 'junit-platform-suite-commons') {
        const platform1Files = matchingFiles.filter(file => platform1Pattern.test(file));
        if (platform1Files.length > 0) {
            return [platform1Files.sort().reverse()[0]];
        }
    }
    
    // Default: return the highest version
    return [matchingFiles.sort().reverse()[0]];
}

// Legacy function for backward compatibility
function selectJarVersion(files, baseName) {
    const versions = selectJarVersions(files, baseName);
    return versions.length > 0 ? versions[0] : null;
}

function updateVersion() {
    // Update the version
    const packageJsonData = require('../package.json');
    const javaExtensions = packageJsonData.contributes.javaExtensions;
    const destFolder = path.resolve('./server');
    const files = fs.readdirSync(destFolder);
    
    if (Array.isArray(javaExtensions)) {
        // Track which base names we've already processed to avoid duplicates
        const processedBaseNames = new Set();
        const newJavaExtensions = [];
        
        for (const extensionString of javaExtensions) {
            const ind = extensionString.indexOf('_');
            if (ind >= 0) {
                const baseName = extensionString.substring(extensionString.lastIndexOf('/') + 1, ind);
                
                // Skip if we've already processed this base name
                if (processedBaseNames.has(baseName)) {
                    continue;
                }
                processedBaseNames.add(baseName);
                
                // Get all versions for this component
                const fileNames = selectJarVersions(files, baseName);
                if (fileNames.length > 0) {
                    for (const fileName of fileNames) {
                        newJavaExtensions.push('./server/' + fileName);
                    }
                } else {
                    // Fallback to finding any matching jar
                    const fallbackFileName = findNewRequiredJar(baseName);
                    if (fallbackFileName) {
                        newJavaExtensions.push('./server/' + fallbackFileName);
                    }
                }
            } else {
                // Non-versioned extension (like the plugin jar)
                newJavaExtensions.push(extensionString);
            }
        }
        
        packageJsonData.contributes.javaExtensions = newJavaExtensions;

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