const gulp = require('gulp');
const cp = require('child_process');
const tslint = require("gulp-tslint");
const sass = require('gulp-sass');
const decompress = require('gulp-decompress');
const download = require('gulp-download');
const path = require("path");

const server_dir = path.join(__dirname, '..');

gulp.task('build-server', ['build-plugin', 'download-server']);

gulp.task('build-plugin', () => {
    cp.execSync(mvnw() + ' clean package', { cwd: server_dir, stdio: [0, 1, 2] });
    gulp.src(path.join(server_dir, 'com.microsoft.java.test.plugin/target/*.jar'))
        .pipe(gulp.dest('./server'));
    gulp.src(path.join(server_dir, 'com.microsoft.java.test.runner/target/*.jar'))
        .pipe(gulp.dest('./server'));
    gulp.src(path.join(server_dir, 'com.microsoft.java.test.runner.junit5/target/*.jar'))
        .pipe(gulp.dest('./server'));
});

gulp.task('download-server', () => {
	download("http://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz")
		.pipe(decompress())
		.pipe(gulp.dest(path.join(server_dir, 'jdtls')));
});

gulp.task("tslint", () => {
    return gulp.src(["**/*.ts", "!**/*.d.ts", "!node_modules/**", "!./src/views/node_modules/**"])
        .pipe(tslint())
        .pipe(tslint.report());
});

gulp.task('sass', () => {
    return gulp.src(['resources/templates/scss/*.scss'])
        .pipe(sass())
        .pipe(gulp.dest("resources/templates/css"));
})

function isWin() {
    return /^win/.test(process.platform);
}

function isMac() {
    return /^darwin/.test(process.platform);
}

function isLinux() {
    return /^linux/.test(process.platform);
}

function mvnw() {
    return isWin() ? "mvnw.cmd" : "./mvnw";
}