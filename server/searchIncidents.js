'use strict';

const postmanRequest = require('postman-request');
const { getAccessToken } = require('./auth');
const { getLogger } = require('polarity-integration-utils').logging;
const { formatTimestamp } = require('./dataTransformations');

// CrowdStrike incident status codes (numeric)
const STATUS_MAP = {
  20: 'New',
  25: 'Reopened',
  30: 'In Progress',
  40: 'Closed'
};

const SEVERITY_MAP = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical'
};

/**
 * Searches Falcon Incidents whose name contains the entity value.
 * Returns up to 10 most recent incidents, sorted newest-first.
 *
 * Required API scope: Incidents: Read
 *
 * @param {string} entityValue - Entity value to search within incident names
 * @param {object} options     - Polarity user options
 * @returns {Promise<Array>}   - Normalized incident objects
 */
const searchIncidents = async (entityValue, options) => {
  const Logger = getLogger();
  const baseUrl = (options.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '');
  const token = await getAccessToken(options);

  const escaped = entityValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Search name OR description — handles IPs in either field
  const filter = `name:~"${escaped}",description:~"${escaped}"`;

  Logger.debug({ filter }, 'searchIncidents: querying incident IDs');

  // Step 1 — query for matching incident IDs
  const ids = await new Promise((resolve, reject) => {
    postmanRequest.get(
      {
        url: `${baseUrl}/incidents/queries/incidents/v1`,
        qs: { filter, limit: 10, sort: 'start|desc' },
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        json: true
      },
      (err, res, body) => {
        if (err) return reject(new Error(`searchIncidents network error: ${err.message}`));
        if (res.statusCode >= 400) {
          Logger.warn({ statusCode: res.statusCode, body }, 'searchIncidents: FQL query returned error — falling back to recent incidents');
          return resolve(null); // null signals "fall back to recent list"
        }
        resolve((body && body.resources) || []);
      }
    );
  });

  // Fallback: FQL unsupported or returned nothing — fetch 20 most recent and filter client-side
  const resolvedIds = ids === null || ids.length === 0
    ? await _fetchRecentIncidentIds(baseUrl, token, Logger)
    : ids;

  // Step 2 — fetch full incident entities by IDs
  const incidents = await new Promise((resolve, reject) => {
    postmanRequest.post(
      {
        url: `${baseUrl}/incidents/entities/incidents/GET/v1`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ ids: resolvedIds })
      },
      (err, res, rawBody) => {
        if (err) return reject(new Error(`searchIncidents entities error: ${err.message}`));
        let body;
        try {
          body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch (_) {
          body = rawBody;
        }
        if (res.statusCode >= 400) {
          Logger.warn({ statusCode: res.statusCode }, 'searchIncidents: entities returned error');
          return resolve([]);
        }
        const resources = (body && body.resources) || [];
        // Client-side filter: when we used the fallback (recent list), narrow to matches
        const lower = entityValue.toLowerCase();
        const filtered = resources.filter((inc) => {
          const nameMatch = (inc.name || inc.incident_id || '').toLowerCase().includes(lower);
          const descMatch = (inc.description || '').toLowerCase().includes(lower);
          return nameMatch || descMatch;
        });
        resolve(
          filtered.map((inc) => ({
            incidentId: inc.incident_id,
            name: inc.name || inc.incident_id || 'Unnamed Incident',
            description: inc.description || '',
            status: STATUS_MAP[inc.status] || String(inc.status || 'Unknown'),
            severity: SEVERITY_MAP[inc.severity] || (inc.severity !== undefined ? String(inc.severity) : 'N/A'),
            start: formatTimestamp(inc.start),
            created: formatTimestamp(inc.created),
            deepLink: _buildIncidentLink(inc.incident_id, baseUrl)
          }))
        );
      }
    );
  });

  return incidents;
};

/**
 * Fallback: fetch the 20 most recent incident IDs with no FQL filter.
 * Used when the FQL filter returns no results or is unsupported.
 * The caller then applies client-side substring matching on the full entities.
 */
const _fetchRecentIncidentIds = (baseUrl, token, Logger) =>
  new Promise((resolve) => {
    postmanRequest.get(
      {
        url: `${baseUrl}/incidents/queries/incidents/v1`,
        qs: { limit: 20, sort: 'start|desc' },
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        json: true
      },
      (err, res, body) => {
        if (err || res.statusCode >= 400) {
          Logger.warn({ err, statusCode: res && res.statusCode }, 'searchIncidents: recent fallback failed');
          return resolve([]);
        }
        resolve((body && body.resources) || []);
      }
    );
  });

const _buildIncidentLink = (incidentId, baseUrl) => {
  const portal = baseUrl.replace('api.crowdstrike.com', 'falcon.crowdstrike.com');
  return `${portal}/incidents/details?id=${encodeURIComponent(incidentId || '')}`;
};

module.exports = { searchIncidents };
