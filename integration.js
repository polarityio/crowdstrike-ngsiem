'use strict';

const {
  logging: { setLogger, getLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { searchEntity } = require('./server/searchEntities');
const { assembleLookupResults } = require('./server/assembleLookupResults');
const { createQueryJob, pollQueryJob, cancelQueryJob } = require('./server/queries');
const { createQueryString, createDeepLink } = require('./server/dataTransformations');
const { request } = require('./server/request');

const doLookup = async (entities, options, cb) => {
  const Logger = getLogger();
  try {
    Logger.debug({ entities }, 'Entities');

    // Set userOptions on the shared request instance before any HTTP calls
    request.userOptions = options;

    const defaultRepos = (options.defaultRepositories || 'search-all')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const searchResults = await Promise.all(
      entities.map((entity) => searchEntity(entity, defaultRepos, options))
    );

    const lookupResults = assembleLookupResults(entities, searchResults, options);

    Logger.trace({ lookupResults }, 'Lookup Results');
    cb(null, lookupResults);
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error({ error, formattedError: err }, 'Lookup Failed');
    cb({ detail: error.message || 'Lookup failed', err });
  }
};

const onMessage = async ({ action, data }, options, cb) => {
  const Logger = getLogger();
  try {
    // Set userOptions on the shared request instance before any HTTP calls
    request.userOptions = options;

    if (action === 'RUN_QUERY') {
      const { entityValue, entityType, selectedRepos } = data;
      const entity = { value: entityValue, type: entityType };

      const result = await searchEntity(entity, selectedRepos, options);

      const queryString = createQueryString(entity, options);
      const firstRepo = (selectedRepos[0] || {}).repositoryValue || selectedRepos[0] || 'search-all';
      const deepLink = createDeepLink(entity, firstRepo, queryString, options);

      return cb(null, {
        repoResults: result.repoResults,
        deepLink,
        query: queryString
      });
    }

    if (action === 'CHECK_STATUS') {
      const { jobId, repositoryValue } = data;
      const pollResult = await pollQueryJob(jobId, repositoryValue);
      return cb(null, { repositoryValue, ...pollResult });
    }

    if (action === 'CANCEL_QUERY') {
      const { jobId, repositoryValue } = data;
      await cancelQueryJob(jobId, repositoryValue);
      return cb(null, { cancelled: true, repositoryValue });
    }

    cb({ detail: `Unknown action: ${action}` });
  } catch (error) {
    const err = parseErrorToReadableJson(error);
    Logger.error({ error, formattedError: err }, 'onMessage Failed');
    cb({ detail: error.message || 'Action failed', err });
  }
};

const validateOptions = async (options, callback) => {
  const errors = [];

  if (!options.apiToken || !options.apiToken.value || !options.apiToken.value.trim()) {
    errors.push({ key: 'apiToken', message: 'You must provide a valid API Token.' });
  }

  if (!options.baseUrl || !options.baseUrl.value || !options.baseUrl.value.trim()) {
    errors.push({ key: 'baseUrl', message: 'You must provide a valid Base URL.' });
  } else {
    try {
      new URL(options.baseUrl.value);
    } catch {
      errors.push({
        key: 'baseUrl',
        message: 'The Base URL must be a valid URL (e.g., https://api.crowdstrike.com).'
      });
    }
  }

  if (options.defaultRepositories && options.defaultRepositories.value) {
    const VALID_REPOS = [
      'search-all',
      'investigate_view',
      'third-party',
      'falcon_for_it_view',
      'forensics_view'
    ];
    const repos = options.defaultRepositories.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = repos.filter((r) => !VALID_REPOS.includes(r));
    if (invalid.length) {
      errors.push({
        key: 'defaultRepositories',
        message: `Invalid repository name(s): ${invalid.join(', ')}. Valid values: ${VALID_REPOS.join(', ')}`
      });
    }
  }

  callback(null, errors);
};

module.exports = {
  startup: setLogger,
  doLookup,
  onMessage,
  validateOptions
};
