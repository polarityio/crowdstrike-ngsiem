'use strict';

const {
  requests: { PolarityRequest }
} = require('polarity-integration-utils');
const { getAccessToken, clearTokenCache } = require('./auth');

/**
 * Shared PolarityRequest instance.
 * IMPORTANT: Set `request.userOptions = options` at the start of doLookup and onMessage
 * before calling any server functions that use this instance.
 *
 * Auth is handled via OAuth2 client_credentials (clientId + clientSecret).
 * Tokens are cached in server/auth.js until 5 minutes before expiry.
 */
const request = new PolarityRequest();

request.preprocessRequestOptions = async (requestOptions, userOptions) => {
  const token = await getAccessToken(userOptions);
  return {
    ...requestOptions,
    url: `${userOptions.baseUrl}/humio/api/v1/${requestOptions.route}`,
    headers: {
      ...requestOptions.headers,
      Authorization: `Bearer ${token}`
    },
    json: true
  };
};

// On 401 errors, clear the cached token so the next request re-authenticates
request.postprocessRequestFailure = async (error, requestOptions, userOptions) => {
  if (error && error.status === 401 && userOptions && userOptions.clientId) {
    clearTokenCache(userOptions.clientId);
  }
  throw error;
};

module.exports = { request };


