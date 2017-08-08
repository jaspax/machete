module.exports = function(grunt) {
    // Programatically find out what packages we include. This is used to factor
    // out our node packages from our actual code.
    const pkg = require('./package.json');
    const dependencies = Object.keys(pkg.dependencies);

    let targetJson = 'production.json';
    if (grunt.option('beta')) {
        targetJson = 'beta.json';
    }

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        target: {
        },
        eslint: {
            options: { ext: '.js' },
            target: ['src'],
        },
        browserify: {
            options: {
                external: dependencies,
            },
            vendor: {
                src: [],
                dest: 'out/src/vendor.js',
                options: {
                    require: dependencies,
                    external: null,
                },
            },
            background: {
                src: ['src/background/background.js'],
                dest: 'out/src/background.js',
            },
            campaign: {
                src: ['src/campaign/campaign.js'],
                dest: 'out/src/campaign.js',
            },
            dashboard: {
                src: ['src/dashboard/dashboard.js'],
                dest: 'out/src/dashboard.js',
            },
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
            scripts: {
                files: ['src/**/*.js'],
                tasks: ['eslint', 'browserify-app']
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
        },
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-run');

    grunt.registerTask('browserify-app', ['browserify:background', 'browserify:campaign', 'browserify:dashboard']);
    grunt.registerTask('generate', ['run:genConst', 'run:genManifest']);
    grunt.registerTask('default', ['generate', 'eslint', 'browserify', 'copy']);
};

