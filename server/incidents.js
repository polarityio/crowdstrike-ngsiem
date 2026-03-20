'use strict';

const { falconRequest } = require('./falconRequest');
const {
  logging: { getLogger }
} = require('polarity-integration-utils');

/**
 * Adds a description annotation to an existing CrowdStrike Falcon Incident.
 *
 * Required API scope: Incidents: Write
 *
 * CrowdStrike uses an action_parameters pattern to update incidents.
 * Supported action names include:
 *   update_description  — set/update the incident description
 *   add_tag             — add a tag
 *   update_status       — set status (20=New, 25=Reopened, 30=In Progress, 40=Closed)
 *   update_assigned_to_uuid — reassign
 *
 * @param {string} incidentId - Falcon incident ID (e.g. "inc:abc123...")
 * @param {string} comment    - Text to write into the incident description
 * @param {object} options    - Polarity user options
 * @returns {{ success, incidentId }}
 */
const annotateIncident = async (incidentId, comment, options) => {
  const Logger = getLogger();

  falconRequest.userOptions = options;

  const response = await falconRequest.run({
    method: 'POST',
    route: '/incidents/v1/incidents/entities/incidents/v1',
    body: {
      action_parameters: [
        { name: 'update_description', value: comment }
      ],
      ids: [incidentId]
    }
  });

  Logger.debug(
    { statusCode: response.statusCode, body: response.body },
    'annotateIncident response'
  );

  const ok = response.statusCode >= 200 && response.statusCode < 300;
  if (!ok) {
    const errMsg =
      (response.body && response.body.errors && response.body.errors[0] && response.body.errors[0].message) ||
      JSON.stringify(response.body);
    throw new Error(`Incident annotation failed (HTTP ${response.statusCode}): ${errMsg}`);
  }

  return { success: true, incidentId };
};

module.exports = { annotateIncident };
