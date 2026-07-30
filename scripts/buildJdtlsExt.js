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
    'org.jacoco.core_',
    'org.objectweb.asm_',
    'org.objectweb.asm.commons_',
    'org.objectweb.asm.tree_'
];
// Set MAVEN_OPTS to disable XML entity size limits for JDK XML parser
const env = { ...process.env };
env.MAVEN_OPTS = (env.MAVEN_OPTS || '') + ' -Djdk.xml.maxGeneralEntitySizeLimit=0 -Djdk.xml.totalEntitySizeLimit=0 -DentityExpansionLimit=0';
// `eclipse.p2.mirrors=false` stops p2 from following download.eclipse.org's mirror
// redirect, which hands out a different third party host per request and makes the
// set of addresses the build contacts impossible to express as an allow list.
cp.execSync(`${mvnw()} clean verify -Declipse.p2.mirrors=false`, { cwd: serverDir, stdio: [0, 1, 2], env });
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
    const version = "0.8.15";
    const jacocoAgentPath = path.resolve('server', 'jacocoagent.jar');
    if (fs.existsSync(jacocoAgentPath)) {
        return;
    }

    // Resolved through Maven rather than downloaded by URL so that it follows whatever
    // repository the build is already pointed at: the public central for contributors,
    // and the CFS mirror that .azure-pipelines/maven-cfs-variables.yml installs on
    // the build agents, which SFI Network Isolation requires. A direct download
    // reaches the public host from every environment and cannot be redirected by
    // settings.xml, because it is not Maven making the request.
    //
    // `-N` keeps this on the parent pom, whose packaging is `pom`, so Tycho has no
    // module to build and skips target platform resolution -- without it this would
    // repeat the expensive p2 work the real build already did.
    const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jacoco-agent-'));
    try {
        cp.execSync(
            `${mvnw()} -B -N org.apache.maven.plugins:maven-dependency-plugin:3.6.1:copy`
            + ` -Dartifact=org.jacoco:org.jacoco.agent:${version}:jar:runtime`
            + ` -DoutputDirectory="${outputDirectory}" -Dmdep.stripVersion=true`,
            { cwd: serverDir, stdio: [0, 1, 2], env });

        // The plugin derives the file name from the coordinate, so it is read back
        // rather than reproduced here.
        const downloaded = fs.readdirSync(outputDirectory).filter((file) => path.extname(file) === '.jar');
        if (downloaded.length !== 1) {
            throw new Error(`Expected one jacoco agent jar, got ${downloaded.length}.`);
        }
        fse.copySync(path.join(outputDirectory, downloaded[0]), jacocoAgentPath);
    } finally {
        fse.removeSync(outputDirectory);
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