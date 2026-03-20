'use strict';

const { REPOSITORIES } = require('../constants');
const { createDeepLink, createQueryString, formatTimestamp } = require('./dataTransformations');

/**
 * Assembles doLookup results from raw search output.
 * Returns null data (no overlay) when no events were found and no jobs are pending.
 */
const assembleLookupResults = (entities, searchResults, options) =>
  entities.map((entity) => {
    const result = searchResults.find((r) => r.entity.value === entity.value);
    if (!result) return { entity, data: null };

    const { repoResults } = result;

    const totalEvents = repoResults.reduce(
      (sum, r) => sum + (r.done ? (r.events || []).length : 0),
      0
    );
    const hasPending = repoResults.some((r) => !r.done);

    // Suppress overlay if nothing found and no pending jobs
    if (totalEvents === 0 && !hasPending) return { entity, data: null };

    const defaultRepos = parseDefaultRepos(options.defaultRepositories);

    const availableRepositories = REPOSITORIES.map((repo) => ({
      ...repo,
      checked: defaultRepos.includes(repo.value)
    }));

    const queryString = createQueryString(entity, options);
    const firstRepo = (repoResults[0] || {}).repositoryValue || 'search-all';

    // Enrich events: format timestamps in-place
    repoResults.forEach((repo) => {
      if (repo.events) {
        repo.events = repo.events.map((event) => enrichEvent(event));
      }
    });

    return {
      entity,
      data: {
        summary: buildSummaryTags(repoResults, hasPending),
        details: {
          query: queryString,
          searchWindow: options.searchWindow || '24hours',
          deepLink: createDeepLink(entity, firstRepo, queryString, options),
          availableRepositories,
          repoResults
        }
      }
    };
  });

/**
 * Enriches a raw NG-SIEM event object:
 * - Adds __formattedTimestamp for display
 * - Adds __eventSimpleName convenience field
 * All __ fields are filtered from the Fields tab in the UI.
 */
const enrichEvent = (event) => {
  const enriched = { ...event };
  const ts = event['@timestamp'] || event.timestamp || event.UTCTimestamp;
  if (ts) enriched.__formattedTimestamp = formatTimestamp(ts);
  if (event['#event_simpleName']) enriched.__eventSimpleName = event['#event_simpleName'];
  return enriched;
};

const buildSummaryTags = (repoResults, hasPending) => {
  const totalEvents = repoResults.reduce(
    (sum, r) => sum + (r.done ? (r.events || []).length : 0),
    0
  );

  if (hasPending && totalEvents === 0) return ['Querying...'];
  if (hasPending) return [`Events: ${totalEvents}`, 'Querying...'];
  if (totalEvents > 0) return [`Events: ${totalEvents}`];
  return ['No Events'];
};

const parseDefaultRepos = (raw) =>
  (raw || 'search-all')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = { assembleLookupResults };

