const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ZipWebpackPlugin = require('zip-webpack-plugin');

const defaultEnv = {
    release: false,
    local: false,
};

module.exports = (env = defaultEnv) => {
    const versionTag = env.release ? 'release' : 'beta';
    let define = null;
    let hostname = 'machete-app.com';
    if (env.release) {
        define = new webpack.DefinePlugin({
            'process.env.MACHETE_LOCAL': JSON.stringify(false),
            'process.env.ANALYTICS_ID': JSON.stringify("UA-98724833-1"),
            'process.env.HOSTNAME': JSON.stringify(hostname),
            'process.env.PRODUCT': JSON.stringify('sp'),
            'process.env.NODE_ENV': JSON.stringify('production'),
        });
    }
    else {
        hostname = 'beta.machete-app.com';
        define = new webpack.DefinePlugin({
            'process.env.MACHETE_LOCAL': env.local,
            'process.env.ANALYTICS_ID': JSON.stringify("UA-98724833-2"),
            'process.env.HOSTNAME': JSON.stringify(hostname),
            'process.env.PRODUCT': JSON.stringify('sp'),
            'process.env.NODE_ENV': JSON.stringify('development'),
        });
    }

    // Small custom plugin handles manifest mangling
    class ManifestPlugin {
        constructor(options) {
            this.manifest = options.file;
        }

        apply(compiler) {
            compiler.plugin('emit', (compilation, callback) => {
                fs.readFile(this.manifest, 'utf8', (err, data) => {
                    if (err)
                        return callback(err);

                    const manifest = JSON.parse(data);
                    manifest.permissions.push(`https://${hostname}/*`);
                    manifest.name += env.release ? "" : " Beta";
                    const manifestStr = JSON.stringify(manifest);

                    compilation.assets['manifest.json'] = {
                        source: () => manifestStr,
                        size: () => manifestStr.length
                    };
                    callback();
                });
            });

            compiler.plugin('after-emit', (compilation, callback) => {
                compilation.fileDependencies.push(this.manifest);
                callback();
            });
        }
    };

    const plugins = [
        new ManifestPlugin({ file: './manifest.json' }),
        new CopyWebpackPlugin([
            { from: './css/**' },
            { from: './images/**' },
        ]),
        define,
    ];
    if (!env.local) {
        plugins.push(new ZipWebpackPlugin({ filename: `machete-${versionTag}.zip` }));
    }

    return {
        watchOptions: {
            aggregateTimeout: 100,
            ignored: /node_modules/,
        },
        entry: {
            dashboard: './src/dashboard/dashboard.js',
            campaign: './src/campaign/campaign.js',
            background: './src/background/index.js',
            'seller-dash': './src/seller-dash/index.js',
            kdp: './src/kdp/index.js',
        },
        output: {
            path: __dirname + `/out/${versionTag}`,
            filename: "src/[name].js",
        },
        module: {
            rules: [{
                test: /\.jsx?$/,
                exclude: /node_modules/,
                enforce: 'pre',
                loader: 'eslint-loader',
                options: { 
                    cache: true,
                    eslintPath: path.join(__dirname, "node_modules", "eslint")
                }
            },
            {
                test: /mapbox-gl.*\.js$/,
                enforce: 'post',
                loader: 'transform-loader/cacheable?brfs'
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        presets: ['react'],
                        cacheDirectory: true,
                    },
                }]
            },
            {
                test: /\.css$/,
                use: [
                    { loader: 'style-loader' }, 
                    { loader: 'css-loader' }
                ]
            }]
        },
        node: {
            fs: "empty"
        },
        plugins,
        devtool: 'cheap-module-source-map',
    };
};
