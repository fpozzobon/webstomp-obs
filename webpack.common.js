var webpack = require('webpack'),
    path = require('path'),
    CleanWebpackPlugin = require('clean-webpack-plugin');

var libraryName = 'webstompobs',
    dist = '/dist';

module.exports = {
  entry: __dirname + '/src/index.ts',
  context: path.resolve("./src"),
  output: {
    path: path.join(__dirname, dist),
    filename: libraryName + '.bundle.js',
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx' ]
  },
  plugins: [
    new CleanWebpackPlugin(['dist'])
 ],
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
    ]
  }
};
