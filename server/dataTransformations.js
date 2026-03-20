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

/**
 * Formats a timestamp value for display.
 * Handles:
 *   - Unix epoch milliseconds as string (e.g. "1773931803588") — confirmed in live API
 *   - Unix epoch milliseconds as number
 *   - ISO 8601 strings
 * Returns "YYYY-MM-DD HH:MM:SS UTC" or the raw value if unparseable.
 */
const formatTimestamp = (ts) => {
  if (!ts) return 'N/A';
  let ms;
  if (typeof ts === 'number') {
    ms = ts;
  } else if (typeof ts === 'string') {
    // Unix ms epoch strings are all digits, ~13 chars
    if (/^\d{10,15}$/.test(ts.trim())) {
      ms = parseInt(ts, 10);
    } else {
      ms = Date.parse(ts);
    }
  }
  if (!ms || isNaN(ms)) return String(ts);
  const d = new Date(ms);
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseErrorToReadableJSON = (error) =>
  Object.getOwnPropertyNames(error).reduce((acc, key) => {
    acc[key] = error[key];
    return acc;
  }, {});

module.exports = { createQueryString, createDeepLink, formatTimestamp, sleep, parseErrorToReadableJSON };

