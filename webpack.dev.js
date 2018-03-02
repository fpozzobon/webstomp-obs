const merge = require('webpack-merge'),
      commons = require('./webpack.common.js');

module.exports = commons.map((common) => merge(common, {
   devtool: 'inline-source-map'
}));
