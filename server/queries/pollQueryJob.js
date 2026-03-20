'use strict';

const { request } = require('../request');
const { sleep } = require('../dataTransformations');
const { MAX_POLL_ATTEMPTS, POLL_INTERVALS_MS } = require('../../constants');

/**
 * Polls a query job until done or budget exhausted.
 * Respects the API's pollAfter hint on intermediate responses.
 * Requires request.userOptions to be set before calling.
 *
 * Returns:
 *   { done: true, events, metaData, warnings }  — complete
 *   { done: false, jobId }                       — budget exhausted; caller surfaces a "Check Status" button
 */
const pollQueryJob = async (jobId, repositoryValue) => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVALS_MS[attempt]);

    const response = await request.run({
      method: 'GET',
      route: `repositories/${repositoryValue}/queryjobs/${jobId}`
    });

    const result = response.body;

    if (result.done) {
      return {
        done: true,
        events: result.events || [],
        metaData: result.metaData || {},
        warnings: result.warnings || []
      };
    }

    // Respect the API's suggested next-poll delay (fallback to our schedule)
    const pollAfter = result.metaData && result.metaData.pollAfter;
    if (pollAfter && pollAfter > POLL_INTERVALS_MS[attempt]) {
      await sleep(pollAfter - POLL_INTERVALS_MS[attempt]);
    }
  }

  // Budget exhausted — return pending state so the client can offer "Check Status"
  return { done: false, jobId };
};

/**
 * Cancels an in-progress query job.
 * Requires request.userOptions to be set before calling.
 */
const cancelQueryJob = async (jobId, repositoryValue) => {
  await request.run({
    method: 'DELETE',
    route: `repositories/${repositoryValue}/queryjobs/${jobId}`
  });
};

module.exports = { pollQueryJob, cancelQueryJob };
