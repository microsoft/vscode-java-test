// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fse = require('fs-extra');

fse.removeSync('server');
const serverDir = path.resolve('java-extension');
// Bundle prefixes to copy from the p2 repository.
// Each prefix may match multiple versions (e.g., junit-jupiter-api_5.x and junit-jupiter-api_6.x)
// to support both JUnit 5 and JUnit 6.
const bundleList = [
    'org.eclipse.jdt.junit4.runtime_',
    'org.eclipse.jdt.junit5.runtime_',
    'org.eclipse.jdt.junit6.runtime_',
    'org.eclipse.jdt.junit.runtime_',
    'org.eclipse.jdt.junit.core_',
    'org.junit_',
    'junit-jupiter-api_',
    'junit-jupiter-engine_',
    'junit-jupiter-migrationsupport_',
    'junit-jupiter-params_',
    'junit-vintage-engine_',
    'org.opentest4j_',
    'junit-platform-commons_',
    'junit-platform-engine_',
    'junit-platform-launcher_',
    'junit-platform-runner_',
    'junit-platform-suite-api_',
    'junit-platform-suite-commons_',
    'junit-platform-suite-engine_',
    'org.apiguardian.api_',
    'org.jacoco.core_'
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
    // Update the version - rebuild javaExtensions from actual server folder contents
    const packageJsonData = require('../package.json');
    const destFolder = path.resolve('./server');
    const files = fs.readdirSync(destFolder);
    
    // Build new javaExtensions list from all jar files in server folder
    // that match our bundleList prefixes, plus the plugin jar
    const newJavaExtensions = [];
    
    for (const file of files) {
        if (file.endsWith('.jar')) {
            // Check if this file matches any bundle prefix or is the plugin jar
            const isBundle = bundleList.some(prefix => file.startsWith(prefix));
            const isPlugin = file.startsWith('com.microsoft.java.test.plugin');
            
            if (isBundle || isPlugin) {
                newJavaExtensions.push('./server/' + file);
            }
        }
    }
    
    // Sort for consistent ordering
    newJavaExtensions.sort();
    
    packageJsonData.contributes.javaExtensions = newJavaExtensions;

    fs.writeFileSync(path.resolve('package.json'), JSON.stringify(packageJsonData, null, 4));
    fs.appendFileSync(path.resolve('package.json'), os.EOL);
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