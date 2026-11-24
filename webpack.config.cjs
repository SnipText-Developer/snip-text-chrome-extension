const { DefinePlugin } = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    "src/background/service-worker": "./src/background/service-worker.ts",
    "src/content/gmail": "./src/content/gmail.ts",
    "src/content/naver": "./src/content/naver.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    chunkFilename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
      },
    ],
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false,
  },
  plugins: [
    new DefinePlugin({
      __STORAGE_ENCRYPTION_KEY_HEX__: JSON.stringify("26c3f419a04613f7fcc0618049527e7c6cca4eea135e6ceae9b93cbab7c3eeb0"),
    }),
    new HtmlWebpackPlugin({
      template: "./packages/sidebar/index.html",
      filename: "src/page/index.html",
      chunks: ["src/page/index"],
      inject: "body",
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: "public/manifest.json", to: "manifest.json" }],
    }),
  ],
};
