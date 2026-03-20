module.exports = {
  name: 'CrowdStrike Next-Gen SIEM',
  acronym: 'CSNG',
  description:
    'Search CrowdStrike Next-Gen SIEM (NG-SIEM) event data using the Falcon LogScale query job API. Supports all entity types via a user-configurable CQL query template.',
  entityTypes: ['IPv4', 'IPv6', 'IPv4CIDR', 'MD5', 'SHA1', 'SHA256', 'email', 'domain', 'url', 'cve'],
  supportsAdditionalCustomTypes: true,
  onDemandOnly: true,
  defaultColor: 'light-gray',
  styles: ['./client/styles.less'],
  block: {
    component: { file: './client/block.js' },
    template: { file: './client/block.hbs' }
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: '',
    rejectUnauthorized: true
  },
  logging: { level: 'debug' },
  options: [
    {
      key: 'clientId',
      name: 'CrowdStrike Client ID',
      description:
        'CrowdStrike API Client ID used for OAuth2 authentication. Obtain from the Falcon console under API Clients & Keys. Required scopes: NGSIEM:read, NGSIEM:write.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'clientSecret',
      name: 'CrowdStrike Client Secret',
      description:
        'CrowdStrike API Client Secret associated with the Client ID above.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'baseUrl',
      name: 'Base URL',
      description:
        'The base URL for the CrowdStrike API. Do not include a trailing slash. Default: https://api.crowdstrike.com',
      default: 'https://api.crowdstrike.com',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'defaultRepositories',
      name: 'Default Repositories',
      description:
        'Comma-separated list of NG-SIEM repositories to search by default. Valid values: search-all, investigate_view, third-party, falcon_for_it_view, forensics_view. Default: search-all,investigate_view',
      default: 'search-all,investigate_view',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchQuery',
      name: 'Query Template',
      description:
        'CQL query template. Use {{entity}} as a placeholder for the highlighted value. Default: search "{{entity}}" | head(25)',
      default: 'search "{{entity}}" | head(25)',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'searchWindow',
      name: 'Search Window',
      description:
        'How far back to search for events. Examples: 1hour, 24hours, 7days, 30days. Default: 7days',
      default: '7days',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'deepLinkTemplate',
      name: 'Deep Link URL Template',
      description:
        'URL template for linking into Falcon NG-SIEM. Tokens: {{repo}}, {{entity}}, {{query}}, {{start}}.',
      default:
        'https://falcon.crowdstrike.com/investigate/events?repositoryName={{repo}}&query={{query}}&start={{start}}',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};

