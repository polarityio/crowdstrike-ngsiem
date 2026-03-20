'use strict';

const postmanRequest = require('postman-request');
const { getLogger } = require('polarity-integration-utils').logging;

// Per-clientId token cache: clientId → { token, expiresAt }
const tokenCache = new Map();

/**
 * Gets a valid OAuth2 bearer token for the given client credentials.
 * Uses CrowdStrike's /oauth2/token endpoint with client_credentials grant.
 * Caches tokens until 5 minutes before expiry (token lifetime: 1799s).
 */
const getAccessToken = async (options) => {
  const clientId = options.clientId;
  const cached = tokenCache.get(clientId);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const Logger = getLogger();
  Logger.debug({ clientId }, 'Fetching new OAuth2 token');

  return new Promise((resolve, reject) => {
    postmanRequest.post(
      {
        url: `${options.baseUrl}/oauth2/token`,
        form: {
          client_id: options.clientId,
          client_secret: options.clientSecret,
          grant_type: 'client_credentials'
        },
        json: true
      },
      (err, res, body) => {
        if (err) {
          return reject(new Error(`OAuth2 request failed: ${err.message}`));
        }
        if (res.statusCode !== 200) {
          return reject(
            new Error(
              `OAuth2 authentication failed (HTTP ${res.statusCode}): ${
                (body && body.message) || JSON.stringify(body)
              }`
            )
          );
        }
        const { access_token, expires_in } = body;
        if (!access_token) {
          return reject(new Error('OAuth2 response missing access_token'));
        }

        // Cache with 5-minute buffer before expiry
        tokenCache.set(clientId, {
          token: access_token,
          expiresAt: Date.now() + (expires_in - 300) * 1000
        });

        Logger.debug({ clientId, expiresIn: expires_in }, 'OAuth2 token cached');
        resolve(access_token);
      }
    );
  });
};

/**
 * Evicts the cached token for a clientId (call on 401 to force re-auth).
 */
const clearTokenCache = (clientId) => {
  tokenCache.delete(clientId);
};

module.exports = { getAccessToken, clearTokenCache };
