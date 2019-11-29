// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const gulp = require('gulp');
const cp = require('child_process');
const tslint = require('gulp-tslint');
const sass = require('gulp-sass');
const decompress = require('gulp-decompress');
const path = require('path');
const fs = require('fs');
const remoteSrc = require('gulp-remote-src');

const serverDir = path.join(__dirname, 'java-extension');
const resourceDir = path.join(__dirname, 'resources');

// Build required jar files.
gulp.task('build-plugin', (done) => {
    cp.execSync(`${mvnw()} clean package`, { cwd: serverDir, stdio: [0, 1, 2] });
    gulp.src(path.join(serverDir, 'com.microsoft.java.test.plugin/target/*.jar'))
        .pipe(gulp.dest('./server'));
    gulp.src(path.join(serverDir, 'com.microsoft.java.test.runner/target/*.jar'))
        .pipe(gulp.dest('./server'));
    gulp.src(path.join(serverDir, 'com.microsoft.java.test.runner/target/lib/*.jar'))
        .pipe(gulp.dest('./server/lib'));

    const bundleLocation = path.join(serverDir, 'com.microsoft.java.test.plugin.site', 'target', 'repository', 'plugins');
    const bundleList = [
        'org.eclipse.jdt.junit4.runtime_*.jar',
        'org.eclipse.jdt.junit5.runtime_*.jar',
        'org.junit.jupiter.api*.jar',
        'org.junit.jupiter.engine*.jar',
        'org.junit.jupiter.migrationsupport*.jar',
        'org.junit.jupiter.params*.jar',
        'org.junit.vintage.engine*.jar',
        'org.opentest4j*.jar',
        'org.junit.platform.commons*.jar',
        'org.junit.platform.engine*.jar',
        'org.junit.platform.launcher*.jar',
        'org.junit.platform.runner*.jar',
        'org.junit.platform.suite.api*.jar',
        'org.apiguardian*.jar',
    ].map(bundle => path.join(bundleLocation, bundle));
    gulp.src(bundleList)
        .pipe(gulp.dest('./server'))
        .on('end', updateVersion);
    done();
});

// Lint
gulp.task('checkstyle', (done) => {
    cp.execSync(`${mvnw()} verify`, { cwd: serverDir, stdio: [0, 1, 2] });
    done();
});

gulp.task('tslint', (done) => {
    gulp.src(['**/*.ts', '!**/*.d.ts', '!node_modules/**', '!./src/views/node_modules/**'])
        .pipe(tslint())
        .pipe(tslint.report());
    done()
});

gulp.task('lint', gulp.series('checkstyle', 'tslint'));

// Test report resources
gulp.task('sass', (done) => {
    gulp.src(['resources/templates/scss/*.scss'])
        .pipe(sass())
        .pipe(gulp.dest('resources/templates/css'));
    done();
});

gulp.task('download-resources', (done) => {
    remoteSrc(['jquery-3.3.1.slim.min.js'], { base: 'https://code.jquery.com/' })
        .pipe(gulp.dest(path.join(resourceDir, 'templates', 'js')));
    remoteSrc(['popper.min.js'], { base: 'https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/' })
        .pipe(gulp.dest(path.join(resourceDir, 'templates', 'js')));
    remoteSrc(['bootstrap.min.js'], { base: 'https://maxcdn.bootstrapcdn.com/bootstrap/4.1.3/js/' })
        .pipe(gulp.dest(path.join(resourceDir, 'templates', 'js')));
    done();
});

gulp.task('build-resources', gulp.series('sass', 'download-resources'));

function isWin() {
    return /^win/.test(process.platform);
}

function mvnw() {
    return isWin() ? 'mvnw.cmd' : './mvnw';
}

function updateVersion() {
    // Update the version
    const packageJsonData = require('./package.json');
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

        fs.writeFileSync('./package.json', JSON.stringify(packageJsonData, null, 4));
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
