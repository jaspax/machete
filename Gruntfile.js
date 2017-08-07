module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        eslint: {
            options: { ext: '.js' },
            target: ['src'],
        },
        watch: {
            scripts: {
                files: ['js/*.js', 'test/*.js'],
                tasks: ['eslint']
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

    grunt.registerTask('default', ['eslint']);
};

