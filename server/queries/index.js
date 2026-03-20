'use strict';

const { createQueryJob } = require('./createQueryJob');
const { pollQueryJob, cancelQueryJob } = require('./pollQueryJob');

module.exports = { createQueryJob, pollQueryJob, cancelQueryJob };
