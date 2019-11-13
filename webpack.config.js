// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

//@ts-check
const path = require('path');
const FileManagerPlugin = require('filemanager-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
    node: {
        __dirname: false,
        __filename: false,
    },
    entry: {
        "extension.bundle": './extension.bundle.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    },
    output: { // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    externals: {
        vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    },
    devtool: 'source-map',
    resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [{
            test: /\.ts$/,
            exclude: /node_modules/,
            use: [{
                loader: 'ts-loader',
            }]
        }]
    },
    plugins: [
        // Copy files to dist folder where the runtime can find them
        // @ts-ignore
        new FileManagerPlugin({
            onEnd: {
                copy: [
                    {
                        source: path.join(__dirname, 'out', 'test'),
                        destination: path.join(__dirname, 'dist', 'test')
                    },
                ]
            }
        }),
    ],
}
module.exports = config;
