var webpack = require("webpack");

module.exports = {
    entry: "./src/main.ts",
    output: {
        filename: "./dist/bundle.js",
    },

    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
    },

    module: {
        loaders: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
            { test: /\.tsx?$/, loader: "ts-loader" },
            { test: /\.json?$/, loader: "json-loader" }
        ]
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map"
};