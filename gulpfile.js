// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const gulp = require('gulp');
const cp = require('child_process');
const tslint = require('gulp-tslint');
const sass = require('gulp-sass');
const decompress = require('gulp-decompress');
const download = require('gulp-download');
const path = require('path');
const fse = require('fs-extra');
const os = require('os');

const serverDir = path.join(__dirname, 'java-extension');
const resourceDir = path.join(__dirname, 'resources');
const vscodeExtensionsPath = path.join(os.homedir(), '.vscode', 'extensions');

// Build required jar files.
gulp.task('build-plugin', (done) => {
    cp.execSync(`${mvnw()} clean package`, { cwd: serverDir, stdio: [0, 1, 2] });
    gulp.src(path.join(serverDir, 'com.microsoft.java.test.plugin/target/*.jar'))
        .pipe(gulp.dest('./server'));
    gulp.src(path.join(serverDir, 'com.microsoft.java.test.runner/target/*.jar'))
        .pipe(gulp.dest('./server'));
        gulp.src(path.join(serverDir, 'com.microsoft.java.test.runner/target/lib/*.jar'))
        .pipe(gulp.dest('./server/lib'));
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
    download('https://fontawesome.com/v4.7.0/assets/font-awesome-4.7.0.zip')
        .pipe(decompress({strip: 1, filter: file => path.basename(file.path) === 'font-awesome.min.css' || path.dirname(file.path) === 'fonts'}))
        .pipe(gulp.dest(path.join(resourceDir, 'templates')));
    download('https://code.jquery.com/jquery-3.3.1.slim.min.js')
        .pipe(gulp.dest(path.join(resourceDir, 'templates', 'js')));
    download('https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js')
        .pipe(gulp.dest(path.join(resourceDir, 'templates', 'js')));
    download('https://maxcdn.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js')
        .pipe(gulp.dest(path.join(resourceDir, 'templates', 'js')));
    done();
});

gulp.task('build-resources', gulp.series('sass', 'download-resources'));

// For test
gulp.task('install-java-language-server', async (done) => {
    await installExtension('redhat', 'java', '0.31.0');
    done();
});

gulp.task('install-java-debug', async (done) => {
    await installExtension('vscjava', 'vscode-java-debug', '0.13.0');
    done();
});

gulp.task('install-dependency', gulp.series('install-java-language-server', 'install-java-debug'));

async function installExtension(publisher, identifier, version) {
    const extensionPath = path.join(vscodeExtensionsPath, `${publisher}.${identifier}-${version}`);
    if (!await fse.pathExists(extensionPath)) {
        return download(`http://ms-vscode.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${identifier}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`)
            .pipe(decompress({
                filter: file => file.path.startsWith('extension/'),
                map: file => {
                    file.path = file.path.slice('extension/'.length);
                    return file;
                }
            }))
            .pipe(gulp.dest(extensionPath));
    } else {
        console.log(`${publisher}.${identifier}-${version} already installed.`);
    }
}

function isWin() {
    return /^win/.test(process.platform);
}

function mvnw() {
    return isWin() ? 'mvnw.cmd' : './mvnw';
}
