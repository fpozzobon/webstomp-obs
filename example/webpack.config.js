var webpack = require('webpack'),
    path = require('path');

var plugins = [],
  libraryName = 'webstompobsexample';


var config = {
  entry: [
      __dirname + '/typescript/chat.ts'
  ],
  resolve: {
    root: path.resolve('./typescript'),
    extensions: [ '', '.js', '.ts', '.jsx', '.tsx' ]
  },
  output: {
      filename: './dist/index.js',
      libraryTarget: 'umd',
      library: libraryName
  },
  module: {
    preLoaders: [
      { test: /\.tsx?$/, loader: 'tslint', exclude: /node_modules/ }
    ],
    loaders: [
      { test: /\.tsx?$/, loader: 'ts', exclude: /node_modules/ }
    ]
  },
  plugins: plugins,
  // Individual Plugin Options
  tslint: {
    emitErrors: true,
    failOnHint: true
  }
};

module.exports = config;
