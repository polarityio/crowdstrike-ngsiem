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

  const requestBody = {
    name: title,
    description: description || '',
    status: 'new',
    severity: 2
  };

  // Log token prefix only (never log full token)
  Logger.debug(
    {
      url,
      title,
      tokenPrefix: token ? token.substring(0, 20) + '...' : 'MISSING',
      body: requestBody
    },
    'createCase: sending request'
  );

  return new Promise((resolve, reject) => {
    postmanRequest.put(
      {
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestBody)
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

        Logger.debug({ statusCode: res.statusCode, body, url }, 'createCase response');

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const csErrors =
            body && body.errors
              ? body.errors.map((e) => `[${e.code}] ${e.message}`).join('; ')
              : JSON.stringify(body);
          Logger.error(
            { statusCode: res.statusCode, url, body },
            'createCase: CrowdStrike returned error'
          );
          return reject(
            new Error(`Case creation failed (HTTP ${res.statusCode}): ${csErrors}`)
          );
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
