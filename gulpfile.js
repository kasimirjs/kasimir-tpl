
const { src, dest, parallel, task } = require('gulp');
const gulp = require("gulp");
const { watch } = require("gulp-watch");
const concat = require('gulp-concat');
const minify = require("gulp-minify");
const order = require("gulp-order");
const fs = require("fs");
const header = require("gulp-header");
/*
function html() {
    return src('client/templates/*.pug')
        .pipe(pug())
        .pipe(dest('build/html'))
}


 */
function css() {
    return src('src/**/*.css')
        .pipe(concat('kasimir-tpl.css'))
        .pipe(dest('www/dist'))
        .pipe(dest('dist'))
}

var licence = fs.readFileSync("LICENSE.header");

function js() {
    return src('src/**/*.js', { sourcemaps: true })
        .pipe(order([
            "src/core/**/*.js"
        ]))
        .pipe(concat('kasimir-tpl.js'))
        .pipe(dest('www/dist', { sourcemaps: true }))
        .pipe(dest('dist', { sourcemaps: true }))
        .pipe(minify())
        .pipe(header(licence))
        .pipe(dest('dist'));
}

exports.js = js;
exports.css = css;
//exports.html = html;
exports.build = parallel(js, css);

task("watch", function () {
    gulp.watch("src/**/*.*", exports.build)
})
