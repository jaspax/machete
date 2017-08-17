const fs = require('fs');

module.exports = function(grunt) {
    // Programatically find out what packages we include. This is used to factor
    // out our node packages from our actual code.
    const pkg = grunt.file.readJSON('./package.json');
    const dependencies = Object.keys(pkg.dependencies);

    let product = grunt.option('product') || process.env.MACHETE_PRODUCT;
    if (!['seller', 'selfpub'].includes(product)) {
        throw new Error('unknown product: ' + product);
    }

    let sourceDirs = {
        selfpub: ['background', 'campaign', 'dashboard'],
        seller: ['seller-background', 'seller-dashboard'],
    };

    let targetJson = `${product}-beta.json`;
    let releaseTag = 'beta';
    let nodeEnv = 'debug';
    if (grunt.option('release')) {
        targetJson = `${product}-production.json`;
        releaseTag = 'release';
        nodeEnv = 'production';
    }
    if (grunt.option('noDebug')) {
        nodeEnv = 'production';
    }
    const zipFile = `machete-${product}-${releaseTag}.zip`;

    const gruntConfig = {
        // Project configuration.
        pkg,
        eslint: {
            options: { extensions: ['.js', '.jsx'] },
            components: ['src/components'],
            /* More targets created programatically */
        },
        browserify: {
            vendor: {
                src: [],
                dest: `out/${product}/src/vendor.js`,
                options: { 
                    require: dependencies,
                    transform: [
                        ['envify', { global: true, NODE_ENV: nodeEnv } ],
                        ['uglifyify', { global: true }],
                        ['babelify', { presets: ['react'] }]
                    ]
                },
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
                args: [targetJson, `${product}-manifest.json.mustache`, `out/${product}/manifest.json`],
            },
        },
        copy: {
            css: { expand: true, src: 'css/**', dest: `out/${product}`, },
            img: { expand: true, src: 'images/**', dest: `out/${product}`, },
            html: { expand: true, src: 'html/**', dest: `out/${product}`, },
            datepickerCss: { src: 'node_modules/react-datepicker/dist/react-datepicker.css', dest: `out/${product}/css/react-datepicker.css` },
            tableCss: { src: 'node_modules/react-table/react-table.css', dest: `out/${product}/css/react-table.css` },
        },
        watch: {
            genConst: {
                files: ['src/common/constants.js.mustache'],
                tasks: ['run:genConst']
            },
            genManifest: {
                files: [`${product}-manifest.json.mustache`],
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
            [zipFile]: [`out/${product}/**`],
        },
    };

    // Handle JS source directories. For each such directory aside from
    // 'common', create a watch, browserify, and eslint task
    const nobuild = ['common', 'components'];
    for (name of sourceDirs[product]) {
        gruntConfig.eslint[name] = [`src/${name}`];
        gruntConfig.browserify[name] = {
            src: [`src/${name}/*.js`],
            dest: `out/${product}/src/${name}.js`,
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

    grunt.registerTask('app', sourceDirs[product].map(x => `browserify:${x}`));
    grunt.registerTask('generate', ['run:genConst', 'run:genManifest']);
    grunt.registerTask('default', ['generate', 'eslint', 'browserify', 'copy', 'zip']);
};
