const path = require('path');
// const DtsBundlePlugin = require("@teronis/webpack-dts-bundle");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TsConfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const PackageFile = require("./package.json");

module.exports = {
  mode: "development",
  entry: PackageFile.module,
  devtool: "source-map",
  module: {
    rules: [{
      test: /\.tsx?$/,
      loader: ["babel-loader", "ts-loader"]
    },
    {
      test: /\.js$/,
      use: ["source-map-loader"],
      enforce: "pre"
    }
    ]
  },
  output: {
    filename: path.basename(PackageFile.main),
    path: path.resolve(__dirname, path.dirname(PackageFile.main)),
    library: ["Teronis", "Client"],
    libraryTarget: "umd",
    umdNamedDefine: true
  },
  resolve: {
    modules: [
      path.join(__dirname, 'src'),
      "node_modules",
    ],
    extensions: ["js", ".ts", ".tsx", "d.ts"],
    plugins: [new TsConfigPathsPlugin()]
  },
  plugins: [
    new CleanWebpackPlugin()
    //   new DtsBundlePlugin({
    //   name: ".",
    //   main: PackageFile.source,
    //   // prevents deleting <baseDir>/**/*.d.ts outside of <baseDir>
    //   baseDir: path.dirname(PackageFile.source),
    //   // absolute path to prevent the join of <baseDir> and <out>
    //   out: path.resolve(__dirname, PackageFile.types),
    //   removeSource: true,
    //   outputAsModuleFolder: false
    // })
  ]
};