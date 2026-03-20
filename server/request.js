'use strict';

const {
  requests: { PolarityRequest }
} = require('polarity-integration-utils');

/**
 * Shared PolarityRequest instance.
 * IMPORTANT: Set `request.userOptions = options` at the start of doLookup and onMessage
 * before calling any server functions that use this instance.
 */
const request = new PolarityRequest();

request.preprocessRequestOptions = async (requestOptions, userOptions) => ({
  ...requestOptions,
  url: `${userOptions.baseUrl}/humio/api/v1/${requestOptions.route}`,
  headers: {
    ...requestOptions.headers,
    Authorization: `Bearer ${userOptions.apiToken}`
  },
  json: true
});

module.exports = { request };

