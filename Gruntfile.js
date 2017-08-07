module.exports = function(grunt) {
    // Programatically find out what packages we include.
    const pkg = require('./package.json');
    const dependencies = Object.keys(pkg.dependencies);

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
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
        copy: {
            manifest: { src: 'manifest.json', dest: 'out/', },
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
            copy: {
                files: ['manifest.json', 'css/**', 'images/**', 'html/**'],
                tasks: ['copy-all'],
            },
        },
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-browserify');

    grunt.registerTask('copy-all', ['copy:manifest', 'copy:css', 'copy:img', 'copy:html']);
    grunt.registerTask('browserify-app', ['browserify:background', 'browserify:campaign', 'browserify:dashboard']);
    grunt.registerTask('default', ['eslint', 'browserify:vendor', 'browserify-app', 'copy-all']);
};

