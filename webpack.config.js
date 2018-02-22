var webpack = require('webpack'),
    path = require('path'),
    yargs = require('yargs');

var libraryName = 'webstompobs',
    plugins = [],
    outputFile,
    devtoolArg,
    dist = '/example/dist';

if (yargs.argv.p) {
  plugins.push(new webpack.optimize.UglifyJsPlugin({ minimize: true }));
  outputFile = libraryName + '.min.js';
} else if (yargs.argv.n) {
  outputFile = libraryName + '.js';
  dist = '/'
} else {
    outputFile = libraryName + '.js';
    devtoolArg = 'source-map';
}

var config = {
  entry: [
    __dirname + '/src/index.ts'
  ],
  output: {
    path: path.join(__dirname, dist),
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd'
  },
  devtool: devtoolArg,
  module: {
    preLoaders: [
      { test: /\.tsx?$/, loader: 'tslint', exclude: /node_modules/ }
    ],
    loaders: [
      { test: /\.tsx?$/, loader: 'ts', exclude: /node_modules/ }
    ]
  },
  resolve: {
    root: path.resolve('./src'),
    extensions: [ '', '.js', '.ts', '.jsx', '.tsx' ]
  },
  plugins: plugins,

  // Individual Plugin Options
  tslint: {
    emitErrors: true,
    failOnHint: true
  }
};

module.exports = config;
