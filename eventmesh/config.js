'use strict';

const fs = require('fs');
const Promise = require('bluebird');
const path = require('path');
const parseUrl = require('url').parse;
const formatUrl = require('url').format;
const child_process = require('child_process');
const yaml = require('js-yaml');
const _ = require('lodash');
const filename = process.env.SF_EVENTMESH_SETTINGS_PATH;

const ENV = process.env.NODE_ENV || 'development';
process.env.NODE_ENV = _
  .chain(ENV)
  .split(/[_-]/)
  .first()
  .value();
const buffer = fs.readFileSync(filename, 'utf8');
const context = {
  require: require,
  __filename: filename,
  __dirname: path.dirname(filename),
};
const config = yaml.safeLoad(_.template(buffer)(context))[ENV];

module.exports = config;