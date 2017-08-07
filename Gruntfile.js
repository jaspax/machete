module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        eslint: {
            options: { ext: '.js' },
            target: ['src'],
        },
        browserify: {
            options: {},
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
        watch: {
            scripts: {
                files: ['src/**/*.js'],
                tasks: ['eslint', 'browserify-all']
            },
        },
        run: {
            'db-up': {
                cmd: './db-migrate',
                args: [ 'up' ],
            }
        },
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-browserify');

    grunt.registerTask('browserify-all', ['browserify:background', 'browserify:campaign', 'browserify:dashboard']);
    grunt.registerTask('default', ['eslint', 'browserify-all']);
};

