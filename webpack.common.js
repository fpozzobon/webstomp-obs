const webpack = require('webpack'),
      merge = require('webpack-merge'),
      path = require('path'),
      CleanWebpackPlugin = require('clean-webpack-plugin');

const libraryName = 'webstompobs',
      dist = '/dist';

const common = {
  target: 'web',
  entry: __dirname + '/src/index.ts',
  context: path.resolve("./src"),
  output: {
    path: path.join(__dirname, dist),
    filename: libraryName + '.bundle.js',
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
    libraryExport: 'default'
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx' ]
  },
  plugins: [
    new CleanWebpackPlugin(['dist'])
 ],
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
    ]
  }
};

const clientConfig = merge(common, {
  target: 'web',
  output: {
    filename: libraryName + '.web.js'
  }
});

const serverConfig = merge(common, {
  target: 'node',
  output: {
    filename: libraryName + '.node.js'
  }
});

module.exports = [ serverConfig, clientConfig ];
