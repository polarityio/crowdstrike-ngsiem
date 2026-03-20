'use strict';

const postmanRequest = require('postman-request');
const { getAccessToken } = require('./auth');
const { getLogger } = require('polarity-integration-utils').logging;

/**
 * Creates a Falcon investigation case via the CrowdStrike Cases API.
 *
 * NOTE: This is NOT the Message Center (support ticket) API.
 * This creates investigation cases within Falcon Next-Gen SIEM.
 *
 * Required API scope: Cases: Write
 * Endpoint: PUT /cases/entities/cases/v2
 *
 * @param {string} title       - Case name
 * @param {string} description - Case description
 * @param {string} type        - unused (kept for API compat — Falcon Cases uses severity/status instead)
 * @param {object} options     - Polarity user options
 * @returns {{ id, url }}
 */
const createCase = async (title, description, type, options) => {
  const Logger = getLogger();
  const baseUrl = (options.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '');
  const token = await getAccessToken(options);
  const url = `${baseUrl}/cases/entities/cases/v2`;

  Logger.debug({ url, title }, 'createCase: sending request');

  return new Promise((resolve, reject) => {
    postmanRequest.put(
      {
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name: title,
          description: description || '',
          status: 'new',
          severity: 2
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
          url: `${portalBase}/investigations/cases/${caseData.id}`
        });
      }
    );
  });
};

module.exports = { createCase };
