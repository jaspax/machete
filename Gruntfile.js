const fs = require('fs');

module.exports = function(grunt) {
    // Programatically find out what packages we include. This is used to factor
    // out our node packages from our actual code.
    const pkg = require('./package.json');
    const dependencies = Object.keys(pkg.dependencies);

    let targetJson = 'production.json';
    let releaseTag = 'release';
    if (grunt.option('beta')) {
        targetJson = 'beta.json';
        releaseTag = 'beta';
    }
    const zipFile = `machete-${releaseTag}.zip`;

    const gruntConfig = {
        // Project configuration.
        pkg: grunt.file.readJSON('package.json'),
        eslint: {
            options: { ext: '.js' },
        },
        browserify: {
            vendor: {
                src: [],
                dest: 'out/src/vendor.js',
                options: { require: dependencies },
            },
            /* Targets created programatically */
        }, 
        run: {
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
        },
        watch: {
            vendor: {
                files: ['node_modules/**/*.js'],
                tasks: ['browserify:vendor'],
            },
            genConst: {
                files: ['src/common/constants.js.mustache'],
                tasks: ['run:genConst']
            },
            genManifest: {
                files: ['manifest.json.mustache'],
                tasks: ['run:genManifest'],
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
    const dirs = fs.readdirSync('src').filter(x => x != 'common' && fs.lstatSync(`src/${x}`).isDirectory());
    for (name of dirs) {
        gruntConfig.eslint[name] = [`src/${name}`];
        gruntConfig.browserify[name] = {
            src: [`src/${name}/*.js`],
            dest: `out/src/${name}.js`,
            options: { external: dependencies },
        };
        gruntConfig.watch[name] = {
            files: [`src/${name}/*.js`],
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

    grunt.registerTask('browserify-app', dirs.map(x => `browserify:${x}`));
    grunt.registerTask('generate', ['run:genConst', 'run:genManifest']);
    grunt.registerTask('default', ['generate', 'eslint', 'browserify', 'copy', 'zip']);
};
