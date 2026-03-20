'use strict';

const { falconRequest } = require('./falconRequest');
const {
  logging: { getLogger }
} = require('polarity-integration-utils');

/**
 * Creates a Falcon Intelligence Case via the CrowdStrike Cases API.
 *
 * Required API scope: Cases: Write
 *
 * @param {string} title       - Case title (typically pre-filled with entity value)
 * @param {string} description - Free-form description / context for the case
 * @param {string} type        - 'incident' or 'other'
 * @param {object} options     - Polarity user options (clientId, clientSecret, baseUrl)
 * @returns {{ id, url }}
 */
const createCase = async (title, description, type, options) => {
  const Logger = getLogger();

  falconRequest.userOptions = options;

  const response = await falconRequest.run({
    method: 'POST',
    route: '/message-center/entities/cases/v1',
    body: {
      title,
      body: description,
      type,
      detections: [],
      incidents: []
    }
  });

  Logger.debug({ statusCode: response.statusCode, body: response.body }, 'createCase response');

  const ok = response.statusCode >= 200 && response.statusCode < 300;
  if (!ok) {
    const errMsg =
      (response.body && response.body.errors && response.body.errors[0] && response.body.errors[0].message) ||
      JSON.stringify(response.body);
    throw new Error(`Case creation failed (HTTP ${response.statusCode}): ${errMsg}`);
  }

  const caseData =
    response.body && response.body.resources && response.body.resources[0];

  if (!caseData) {
    throw new Error('Case creation succeeded but returned no case data.');
  }

  const baseUrl = (options.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '');
  const falconPortalBase = baseUrl.replace('api.crowdstrike.com', 'falcon.crowdstrike.com');

  return {
    id: caseData.id,
    url: `${falconPortalBase}/support/cases/${caseData.id}`
  };
};

module.exports = { createCase };
