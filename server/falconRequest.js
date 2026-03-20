'use strict';

const {
  requests: { PolarityRequest }
} = require('polarity-integration-utils');
const { getAccessToken, clearTokenCache } = require('./auth');

/**
 * A second PolarityRequest instance for the Falcon platform APIs
 * (Cases, Incidents, etc.) that live directly at the base URL —
 * NOT under /humio/api/v1/ like the NG-SIEM query API.
 *
 * Usage:
 *   falconRequest.userOptions = options;
 *   const response = await falconRequest.run({ method, route, body });
 *
 * `route` should start with '/', e.g. '/case/v1/cases'.
 */
const falconRequest = new PolarityRequest();

falconRequest.preprocessRequestOptions = async (requestOptions, userOptions) => {
  const token = await getAccessToken(userOptions);
  return {
    ...requestOptions,
    url: `${(userOptions.baseUrl || 'https://api.crowdstrike.com').replace(/\/$/, '')}${requestOptions.route}`,
    headers: {
      ...requestOptions.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    json: true
  };
};

falconRequest.postprocessRequestFailure = async (error, requestOptions, userOptions) => {
  if (error && error.status === 401 && userOptions && userOptions.clientId) {
    clearTokenCache(userOptions.clientId);
  }
  throw error;
};

module.exports = { falconRequest };
