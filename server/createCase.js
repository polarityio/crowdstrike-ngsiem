'use strict';

const postmanRequest = require('postman-request');
const { getAccessToken } = require('./auth');
const { getLogger } = require('polarity-integration-utils').logging;

/**
 * Creates a Falcon support case via the CrowdStrike Message Center API.
 *
 * Required API scope: Message Center: Write
 *
 * @param {string} title       - Case title
 * @param {string} description - Case body / description
 * @param {string} type        - 'incident' or 'other'
 * @param {object} options     - Polarity user options
 * @returns {{ id, url }}
 */
const createCase = async (title, description, type, options) => {
  const Logger = getLogger();
  const baseUrl = (options.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '');
  const token = await getAccessToken(options);
  const url = `${baseUrl}/message-center/entities/cases/v1`;

  Logger.debug({ url, title, type }, 'createCase: sending request');

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
          title,
          body: description,
          type: type || 'incident',
          detections: [],
          incidents: []
        })
      },
      (err, res, rawBody) => {
        if (err) {
          return reject(new Error(`createCase network error: ${err.message}`));
        }

        let body;
        try {
          body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch (_) {
          body = rawBody;
        }

        Logger.debug({ statusCode: res.statusCode, body }, 'createCase response');

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errMsg =
            (body && body.errors && body.errors[0] && body.errors[0].message) ||
            JSON.stringify(body);
          return reject(new Error(`Case creation failed (HTTP ${res.statusCode}): ${errMsg}`));
        }

        const caseData = body && body.resources && body.resources[0];
        if (!caseData) {
          return reject(new Error('Case creation succeeded but CrowdStrike returned no case data.'));
        }

        const portalBase = baseUrl.replace('api.crowdstrike.com', 'falcon.crowdstrike.com');
        resolve({
          id: caseData.id,
          url: `${portalBase}/support/cases/${caseData.id}`
        });
      }
    );
  });
};

module.exports = { createCase };
