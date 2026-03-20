'use strict';

const { request } = require('../request');
const { createQueryString } = require('../dataTransformations');

/**
 * Creates an async query job in NG-SIEM for a given repository.
 * Returns the job ID and the query string that was submitted.
 * Requires request.userOptions to be set before calling.
 */
const createQueryJob = async (entity, repositoryValue, options) => {
  const queryString = createQueryString(entity, options);

  const response = await request.run({
    method: 'POST',
    route: `repositories/${repositoryValue}/queryjobs`,
    body: {
      queryString,
      start: options.searchWindow || '24hours',
      end: 'now'
    }
  });

  return {
    jobId: response.body.id,
    queryString
  };
};

module.exports = { createQueryJob };

