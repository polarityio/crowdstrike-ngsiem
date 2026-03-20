'use strict';

const postmanRequest = require('postman-request');
const { getAccessToken } = require('./auth');
const { getLogger } = require('polarity-integration-utils').logging;

/**
 * Adds a description annotation to an existing CrowdStrike Falcon Incident.
 *
 * Required API scope: Incidents: Write
 *
 * @param {string} incidentId - Falcon incident ID (e.g. "inc:abc123...")
 * @param {string} comment    - Text to write into the incident description
 * @param {object} options    - Polarity user options
 * @returns {{ success, incidentId }}
 */
const annotateIncident = async (incidentId, comment, options) => {
  const Logger = getLogger();
  const baseUrl = (options.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '');
  const token = await getAccessToken(options);
  const url = `${baseUrl}/incidents/entities/incidents/v1`;

  Logger.debug({ url, incidentId }, 'annotateIncident: sending request');

  return new Promise((resolve, reject) => {
    postmanRequest.post(
      {
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          action_parameters: [
            { name: 'update_description', value: comment }
          ],
          ids: [incidentId]
        })
      },
      (err, res, rawBody) => {
        if (err) {
          return reject(new Error(`annotateIncident network error: ${err.message}`));
        }

        let body;
        try {
          body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch (_) {
          body = rawBody;
        }

        Logger.debug({ statusCode: res.statusCode, body }, 'annotateIncident response');

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errMsg =
            (body && body.errors && body.errors[0] && body.errors[0].message) ||
            JSON.stringify(body);
          return reject(new Error(`Incident annotation failed (HTTP ${res.statusCode}): ${errMsg}`));
        }

        resolve({ success: true, incidentId });
      }
    );
  });
};

module.exports = { annotateIncident };
