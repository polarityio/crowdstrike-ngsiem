'use strict';

const {
  logging: { setLogger, getLogger },
  errors: { parseErrorToReadableJson }
} = require('polarity-integration-utils');

const { searchEntity } = require('./server/searchEntities');
const { assembleLookupResults } = require('./server/assembleLookupResults');
const { createQueryJob, pollQueryJob, cancelQueryJob } = require('./server/queries');
const { createQueryString, createDeepLink, formatTimestamp } = require('./server/dataTransformations');
const { request } = require('./server/request');
const { createCase } = require('./server/createCase');
const { annotateIncident } = require('./server/incidents');
const { searchCases } = require('./server/searchCases');
const { searchIncidents } = require('./server/searchIncidents');

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
      const { entityValue, entityType } = data;
      const entity = { value: entityValue, type: entityType };

      // Always search all configured repos — user filters post-search by collapsing sections
      const defaultRepos = (options.defaultRepositories || 'search-all')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const result = await searchEntity(entity, defaultRepos, options);

      const queryString = createQueryString(entity, options);
      const firstRepo = defaultRepos[0] || 'search-all';
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

    if (action === 'CREATE_CASE') {
      const { title, description, type, entityValue } = data;
      const result = await createCase(title || entityValue, description, type || 'incident', options);
      return cb(null, result);
    }

    if (action === 'ANNOTATE_INCIDENT') {
      const { incidentId, comment } = data;
      const result = await annotateIncident(incidentId, comment, options);
      return cb(null, result);
    }

    if (action === 'SEARCH_CASES') {
      const { entityValue } = data;
      const cases = await searchCases(entityValue, options);
      return cb(null, { cases });
    }

    if (action === 'SEARCH_INCIDENTS') {
      const { entityValue } = data;
      const incidents = await searchIncidents(entityValue, options);
      return cb(null, { incidents });
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

  if (!options.clientId || !options.clientId.value || !options.clientId.value.trim()) {
    errors.push({ key: 'clientId', message: 'You must provide a valid CrowdStrike Client ID.' });
  }

  if (!options.clientSecret || !options.clientSecret.value || !options.clientSecret.value.trim()) {
    errors.push({ key: 'clientSecret', message: 'You must provide a valid CrowdStrike Client Secret.' });
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

  // If no config errors so far, attempt a live OAuth2 token request to validate credentials
  if (errors.length === 0) {
    try {
      const { getAccessToken, clearTokenCache } = require('./server/auth');
      const testOptions = {
        clientId: options.clientId.value,
        clientSecret: options.clientSecret.value,
        baseUrl: options.baseUrl.value || 'https://api.crowdstrike.com'
      };
      // Clear any cached token first so we do a fresh auth test
      clearTokenCache(testOptions.clientId);
      await getAccessToken(testOptions);
    } catch (authError) {
      errors.push({
        key: 'clientSecret',
        message: `Authentication failed: ${authError.message}`
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
