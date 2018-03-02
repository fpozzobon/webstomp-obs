var webpack = require('webpack'),
    path = require('path'),
    CleanWebpackPlugin = require('clean-webpack-plugin');

var libraryName = 'webstompobsexample';


var config = {
  context: path.resolve('./typescript'),
  entry: __dirname + '/typescript/chat.ts',
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx' ]
  },
  target: 'web',
  devtool: 'inline-source-map',
  output: {
      path: path.join(__dirname, '/dist'),
      filename: 'index.js',
      library: libraryName,
      libraryTarget: 'umd',
      umdNamedDefine: true,
      libraryExport: 'default'
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(['dist'])
  ]
};

module.exports = config;
