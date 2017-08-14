const fs = require('fs');

module.exports = function(grunt) {
    // Programatically find out what packages we include. This is used to factor
    // out our node packages from our actual code.
    const pkg = require('./package.json');
    const dependencies = Object.keys(pkg.dependencies);

    let targetJson = 'beta.json';
    let releaseTag = 'beta';
    if (grunt.option('release')) {
        targetJson = 'production.json';
        releaseTag = 'release';
    }
    const zipFile = `machete-${releaseTag}.zip`;

    const gruntConfig = {
        // Project configuration.
        pkg: grunt.file.readJSON('package.json'),
        eslint: {
            options: { extensions: ['.js', '.jsx'] },
            components: ['src/components'],
            /* More targets created programatically */
        },
        browserify: {
            vendor: {
                src: [],
                dest: 'out/src/vendor.js',
                options: { require: dependencies },
            },
            /* More targets created programatically */
        }, 
        run: {
            clean: {
                cmd: 'rm',
                args: ['-rf', 'out', zipFile]
            },
            genConst: {
                cmd: './node_modules/.bin/mustache',
                args: [targetJson, 'src/common/constants.js.mustache', 'src/common/constants.gen.js'],
            },
            genManifest: {
                cmd: './node_modules/.bin/mustache',
                args: [targetJson, 'manifest.json.mustache', 'out/manifest.json'],
            },
        },
        copy: {
            css: { expand: true, src: 'css/**', dest: 'out/', },
            img: { expand: true, src: 'images/**', dest: 'out/', },
            html: { expand: true, src: 'html/**', dest: 'out/', },
            datepickerCss: { src: 'node_modules/react-datepicker/dist/react-datepicker.css', dest: 'out/css/react-datepicker.css' },
            tableCss: { src: 'node_modules/react-table/react-table.css', dest: 'out/css/react-table.css' },
        },
        watch: {
            genConst: {
                files: ['src/common/constants.js.mustache'],
                tasks: ['run:genConst']
            },
            genManifest: {
                files: ['manifest.json.mustache'],
                tasks: ['run:genManifest'],
            },
            components: {
                files: ['src/components/*.jsx'],
                tasks: ['eslint:components']
            },
            copy: {
                files: ['css/**', 'images/**', 'html/**'],
                tasks: ['copy'],
            },
            /* Targets created programatically */
        },
        zip: {
            [zipFile]: ['out/**'],
        },
    };

    // Handle JS source directories. For each such directory aside from
    // 'common', create a watch, browserify, and eslint task
    const nobuild = ['common', 'components'];
    const dirs = fs.readdirSync('src').filter(x => fs.lstatSync(`src/${x}`).isDirectory() && !nobuild.includes(x));
    for (name of dirs) {
        gruntConfig.eslint[name] = [`src/${name}`];
        gruntConfig.browserify[name] = {
            src: [`src/${name}/*.js`],
            dest: `out/src/${name}.js`,
            options: {
                external: dependencies,
                transform: [['babelify', {presets: ['react']}]]
            },
        };
        gruntConfig.watch[`${name}-eslint`] = {
            files: [`src/${name}/**`],
            tasks: [`eslint:${name}`, `browserify:${name}`]
        };
    }
    
    grunt.initConfig(gruntConfig);

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-run');
    grunt.loadNpmTasks('grunt-zip');

    grunt.registerTask('app', dirs.map(x => `browserify:${x}`));
    grunt.registerTask('generate', ['run:genConst', 'run:genManifest']);
    grunt.registerTask('default', ['generate', 'eslint', 'browserify', 'copy', 'zip']);
};
