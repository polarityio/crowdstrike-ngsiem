'use strict';

const postmanRequest = require('postman-request');
const { getAccessToken } = require('./auth');
const { getLogger } = require('polarity-integration-utils').logging;

const SEVERITY_MAP = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
const STATUS_MAP = {
  new: 'New',
  'in-progress': 'In Progress',
  open: 'Open',
  closed: 'Closed'
};

/**
 * Searches Falcon Intelligence Cases whose name contains the entity value.
 * Returns up to 10 most recent cases, sorted newest-first.
 *
 * Required API scope: Cases: Read
 *
 * @param {string} entityValue - Entity value to search within case names
 * @param {object} options     - Polarity user options
 * @returns {Promise<Array>}   - Normalized case objects
 */
const searchCases = async (entityValue, options) => {
  const Logger = getLogger();
  const baseUrl = (options.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '');
  const token = await getAccessToken(options);

  const escaped = entityValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const filter = `name:~"${escaped}"`;

  Logger.debug({ filter }, 'searchCases: querying case IDs');

  // Step 1 — query for matching case IDs
  const ids = await new Promise((resolve, reject) => {
    postmanRequest.get(
      {
        url: `${baseUrl}/cases/queries/cases/v1`,
        qs: { filter, limit: 10, sort: 'created_at|desc' },
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        json: true
      },
      (err, res, body) => {
        if (err) return reject(new Error(`searchCases network error: ${err.message}`));
        if (res.statusCode >= 400) {
          const msg =
            (body && body.errors && body.errors[0] && body.errors[0].message) ||
            `HTTP ${res.statusCode}`;
          Logger.warn({ statusCode: res.statusCode, body }, 'searchCases: query returned error');
          return resolve([]); // degrade gracefully — show empty list, not hard error
        }
        resolve((body && body.resources) || []);
      }
    );
  });

  if (!ids.length) return [];

  // Step 2 — fetch full case entities by IDs
  const cases = await new Promise((resolve, reject) => {
    postmanRequest.post(
      {
        url: `${baseUrl}/cases/entities/cases/GET/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ ids })
      },
      (err, res, rawBody) => {
        if (err) return reject(new Error(`searchCases entities error: ${err.message}`));
        let body;
        try {
          body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch (_) {
          body = rawBody;
        }
        if (res.statusCode >= 400) {
          Logger.warn({ statusCode: res.statusCode }, 'searchCases: entities returned error');
          return resolve([]);
        }
        const resources = (body && body.resources) || [];
        resolve(
          resources.map((c) => ({
            id: c.id,
            name: c.name || 'Unnamed Case',
            description: c.description || '',
            status: STATUS_MAP[c.status] || c.status || 'Unknown',
            severity: SEVERITY_MAP[c.severity] || (c.severity !== undefined ? String(c.severity) : 'N/A'),
            createdAt: _formatDate(c.created_at || c.createdAt),
            updatedAt: _formatDate(c.updated_at || c.updatedAt),
            deepLink: _buildCaseLink(c.id, baseUrl)
          }))
        );
      }
    );
  });

  return cases;
};

const _formatDate = (ts) => {
  if (!ts) return null;
  try {
    return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  } catch (_) {
    return String(ts);
  }
};

const _buildCaseLink = (id, baseUrl) => {
  const portal = baseUrl.replace('api.crowdstrike.com', 'falcon.crowdstrike.com');
  return `${portal}/investigations/cases/${id}`;
};

module.exports = { searchCases };
