const webpack = require('webpack'),
      merge = require('webpack-merge'),
      UglifyJSPlugin = require('uglifyjs-webpack-plugin'),
      commons = require('./webpack.common.js');

module.exports = commons.map((common) => merge(common, {
  devtool: 'source-map',
  plugins: [
    new UglifyJSPlugin({
      sourceMap: true
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
}));
