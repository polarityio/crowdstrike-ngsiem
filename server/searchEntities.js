'use strict';

const { createQueryJob } = require('./queries/createQueryJob');
const { pollQueryJob } = require('./queries/pollQueryJob');
const { REPOSITORIES } = require('../constants');

/**
 * Runs query jobs for the given entity across all selected repositories in parallel.
 * Each repo gets its own async job: create → poll → return result.
 */
const searchEntity = async (entity, repositoryValues, options) => {
  const repoResults = await Promise.all(
    repositoryValues.map(async (repositoryValue) => {
      const repoInfo = REPOSITORIES.find((r) => r.value === repositoryValue) || {
        label: repositoryValue,
        value: repositoryValue
      };

      const { jobId, queryString } = await createQueryJob(entity, repositoryValue, options);
      const pollResult = await pollQueryJob(jobId, repositoryValue);

      return {
        repositoryValue,
        label: repoInfo.label,
        queryString,
        ...pollResult
      };
    })
  );

  return { entity, repoResults };
};

module.exports = { searchEntity };
