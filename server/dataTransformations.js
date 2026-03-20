'use strict';

/**
 * Builds a CQL query string by substituting {{entity}} with the escaped entity value.
 */
const createQueryString = (entity, options) => {
  const template = options.searchQuery || 'search "{{entity}}" | head(10)';
  return template.replace(/{{entity}}/gi, escapeForCql(entity.value));
};

/**
 * Escape entity value for safe embedding inside a CQL quoted string.
 * Removes newlines and escapes double-quotes.
 */
const escapeForCql = (value) =>
  value.replace(/(\r\n|\n|\r)/g, '').replace(/"/g, '\\"');

/**
 * Builds a deep-link URL into the Falcon NG-SIEM UI.
 * Supports {{repo}}, {{entity}}, {{query}}, {{start}} token substitution.
 */
const createDeepLink = (entity, repositoryValue, queryString, options) => {
  const template =
    options.deepLinkTemplate ||
    'https://falcon.crowdstrike.com/investigate/events?repositoryName={{repo}}&query={{query}}&start={{start}}';

  return template
    .replace('{{repo}}', encodeURIComponent(repositoryValue))
    .replace('{{entity}}', encodeURIComponent(entity.value))
    .replace('{{query}}', encodeURIComponent(queryString))
    .replace('{{start}}', encodeURIComponent(options.searchWindow || '24hours'));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseErrorToReadableJSON = (error) =>
  Object.getOwnPropertyNames(error).reduce((acc, key) => {
    acc[key] = error[key];
    return acc;
  }, {});

module.exports = { createQueryString, createDeepLink, sleep, parseErrorToReadableJSON };
