const fs = require('fs');

module.exports = function(grunt) {
    // Programatically find out what packages we include. This is used to factor
    // out our node packages from our actual code.
    const pkg = grunt.file.readJSON('./package.json');
    const dependencies = Object.keys(pkg.dependencies);

    let product = grunt.option('product') || process.env.MACHETE_PRODUCT;
    if (!['seller', 'sp'].includes(product)) {
        throw new Error('unknown product: ' + product);
    }

    let sourceDirs = {
        sp: ['background', 'campaign', 'dashboard'],
        seller: ['seller-background', 'seller-dash'],
    };

    const releaseTag = grunt.option('release') ? 'release' : 'beta';
    const targetJson = `config/${product}-${releaseTag}.json`;
    const env = grunt.file.readJSON(targetJson);
    if (grunt.option('noDebug')) {
        env.NODE_ENV = 'production';
    }

    let vendorTransforms = [];
    if (releaseTag == 'release') {
        vendorTransforms = [
            ['envify', Object.assign({ global: true }, env)],
            ['uglifyify', { global: true }],
            ['babelify', { presets: ['react'] }]
        ];
    }
    else {
        vendorTransforms = [
            ['envify', Object.assign({ global: true }, env)],
            ['babelify', { presets: ['react'] }]
        ];
    }

    const gruntConfig = {
        pkg,
        execute: {
            manifest: {
                call: (grunt, options) => {
                    const manifest = grunt.file.readJSON(`${product}-manifest.json`);
                    manifest.name = env.NAME;
                    manifest.permissions.push(`https://${env.HOSTNAME}/*`);
                    grunt.file.write(`out/${product}/manifest.json`, JSON.stringify(manifest));
                },
            }
        },
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
                    transform: vendorTransforms,
                },
            },
            /* More targets created programatically */
        }, 
        copy: {
            css: { expand: true, src: 'css/**', dest: `out/${product}`, },
            img: { expand: true, src: 'images/**', dest: `out/${product}`, },
            html: { expand: true, flatten: true, src: `html/${product}/**`, dest: `out/${product}/html`, },
            datepickerCss: { src: 'node_modules/react-datepicker/dist/react-datepicker.css', dest: `out/${product}/css/react-datepicker.css` },
            tableCss: { src: 'node_modules/react-table/react-table.css', dest: `out/${product}/css/react-table.css` },
        },
        watch: {
            components: {
                files: ['src/components/*.jsx'],
                tasks: ['eslint:components']
            },
            copy: {
                files: ['css/**', 'images/**', 'html/**'],
                tasks: ['copy'],
            },
            manifest: {
                files: [`${product}-manifest.json`],
                tasks: ['execute:manifest']
            },
            /* Targets created programatically */
        },
        zip: {
            [`machete-${product}-${releaseTag}.zip`]: [`out/${product}/**`],
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
                transform: [
                    ['babelify', {presets: ['react']}],
                    ['envify', env],
                ]
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
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-execute');

    grunt.registerTask('app', sourceDirs[product].map(x => `browserify:${x}`));
    grunt.registerTask('default', ['execute', 'eslint', 'browserify', 'copy', 'zip']);
};
