const fs = require('fs');
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
        }
    };

    return {
        entry: {
            dashboard: './src/dashboard/dashboard.js',
            campaign: './src/campaign/campaign.js',
            background: './src/background/background.js',
            'seller-dash': './src/seller-dash/index.js',
            'seller-background': './src/seller-background/index.js',
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
                    failOnWarning: true,
                    failOnError: true,
                }
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
            }]
        },
        node: {
            fs: "empty"
        },
        plugins: [
            new ManifestPlugin({ file: './sp-manifest.json' }),
            new CopyWebpackPlugin([
                { from: './css/**', to: `./out/${versionTag}` },
                { from: './images/**', to: `./out/${versionTag}` },
            ]),
            define,
            new ZipWebpackPlugin({ filename: `machete-${versionTag}.zip`, }),
        ],
    };
};
