const fs = require('fs');

module.exports = function(grunt) {
    const releaseTag = grunt.option('release') ? 'release' : 'beta';
    const manifest = grunt.file.readJSON('manifest.json');

    const gruntConfig = {
        run: {
            publish: {
                cmd: 'node',
                args: ['upload-package.js', env.APP_ID, pkgPath],
            }
        },
        gittag: {
            publish: {
                options: {
                    tag: `${product}-${releaseTag}-${manifest.version}`,
                }
            }
        },
        gitpush: {
            github: {
                options: { remote: 'github' }
            },
            githubTags: {
                options: { remote: 'github', tags: true, }
            },
            origin: {
                options: { remote: 'origin' }
            },
            originTags: {
                options: { remote: 'origin' }
            },
        }
    };

    grunt.initConfig(gruntConfig);
    grunt.loadNpmTasks('grunt-run');
    grunt.loadNpmTasks('grunt-git');

    const publishTasks = ['run:publish', 'gittag:publish', 'gitpush:origin', 'gitpush:originTags'];
    if (releaseTag == 'release')
        publishTasks.push('gitpush:github', 'gitpush:githubTags');
    grunt.registerTask('publish', publishTasks);
};
