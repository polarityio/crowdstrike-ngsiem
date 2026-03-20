polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  repoResults: Ember.computed.alias('details.repoResults'),

  hasResults: Ember.computed('repoResults.[]', function () {
    const results = this.get('repoResults') || [];
    return results.some((r) => r.done && r.events && r.events.length > 0);
  }),

  hasPendingJobs: Ember.computed('repoResults.[]', function () {
    return (this.get('repoResults') || []).some((r) => !r.done);
  }),

  init() {
    this._super(...arguments);
    if (!this.get('block._state')) {
      const repoVisibility = {};
      (this.get('repoResults') || []).forEach((r) => {
        repoVisibility[r.repositoryValue] = true;
      });
      const entityValue = (this.get('block.entity') || {}).value || '';
      this.set('block._state', {
        isQuerying: false,
        error: null,
        repoVisibility: repoVisibility,
        showCreateCase: false,
        caseTitle: entityValue,
        caseDescription: '',
        caseType: 'incident',
        caseLoading: false,
        caseError: null,
        caseSuccess: null,
        showAnnotateIncident: false,
        incidentId: '',
        incidentComment: '',
        incidentLoading: false,
        incidentError: null,
        incidentSuccess: null
      });
    }
    this._initEventTabs(this.get('repoResults') || []);
    this._buildReadableJson(this.get('repoResults') || []);
    this._buildDisplayFields(this.get('repoResults') || []);
  },

  _initEventTabs: function (repoResults) {
    (repoResults || []).forEach(function (repo) {
      (repo.events || []).forEach(function (event) {
        if (!event.__activeTab) {
          Ember.set(event, '__activeTab', 'fields');
        }
      });
    });
  },

  _PRIORITY_KEYS: [
    { key: '__formattedTimestamp', label: 'Timestamp' },
    { key: '#event_simpleName', label: 'Event Type' },
    { key: 'ComputerName', label: 'ComputerName' },
    { key: 'LocalAddressIP4', label: 'Local IP' },
    { key: 'aip', label: 'External IP' },
    { key: 'aid', label: 'Agent ID' },
    { key: 'event_platform', label: 'Platform' }
  ],

  _buildDisplayFields: function (repoResults) {
    const priorityKeys = this._PRIORITY_KEYS;
    const priorityKeyNames = priorityKeys.map(function (p) { return p.key; });

    (repoResults || []).forEach(function (repo) {
      (repo.events || []).forEach(function (event) {
        const fields = [];

        priorityKeys.forEach(function (pk) {
          if (event[pk.key] !== undefined && event[pk.key] !== null && event[pk.key] !== '') {
            fields.push({ key: pk.label, value: String(event[pk.key]) });
          }
        });

        const skipKeys = priorityKeyNames.concat(['@timestamp', 'timestamp', 'UTCTimestamp', '#event_simpleName']);
        Object.keys(event).forEach(function (k) {
          if (!k.startsWith('__') && skipKeys.indexOf(k) === -1) {
            fields.push({ key: k, value: String(event[k]) });
          }
        });

        Ember.set(event, '__displayFields', fields);
      });
    });
  },

  _buildReadableJson: function (repoResults) {
    const self = this;
    (repoResults || []).forEach(function (repo) {
      (repo.events || []).forEach(function (event) {
        const clean = {};
        Object.keys(event).forEach(function (k) {
          if (!k.startsWith('__')) clean[k] = event[k];
        });
        Ember.set(event, '__jsonHighlighted', self._syntaxHighlight(JSON.stringify(clean, null, 2)));
      });
    });
  },

  _syntaxHighlight: function (json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        var cls = 'csng-json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'csng-json-key' : 'csng-json-string';
        } else if (/true|false/.test(match)) {
          cls = 'csng-json-boolean';
        } else if (/null/.test(match)) {
          cls = 'csng-json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );
  },

  actions: {
    toggleRepoVisibility: function (repoValue) {
      const key = 'block._state.repoVisibility.' + repoValue;
      this.set(key, !this.get(key));
    },

    runQuery: function () {
      this.set('block._state.error', null);
      this.set('block._state.isQuerying', true);

      const entity = this.get('block.entity');
      this.sendIntegrationMessage({
        action: 'RUN_QUERY',
        data: { entityValue: entity.value, entityType: entity.type }
      })
        .then((response) => {
          this.set('block._state.isQuerying', false);
          this.set('block.data.details.repoResults', response.repoResults);
          if (response.deepLink) this.set('block.data.details.deepLink', response.deepLink);
          if (response.query) this.set('block.data.details.query', response.query);

          const visibility = this.get('block._state.repoVisibility') || {};
          (response.repoResults || []).forEach(function (r) {
            if (visibility[r.repositoryValue] === undefined) {
              visibility[r.repositoryValue] = true;
            }
          });
          this.set('block._state.repoVisibility', Object.assign({}, visibility));

          this._initEventTabs(response.repoResults);
          this._buildReadableJson(response.repoResults);
          this._buildDisplayFields(response.repoResults);
        })
        .catch((err) => {
          this.set('block._state.isQuerying', false);
          this.set('block._state.error', (err && err.detail) || 'Query failed. Please try again.');
        });
    },

    changeTab: function (tabName, repositoryValue, eventIndex) {
      const results = this.get('repoResults') || [];
      const repo = results.find((r) => r.repositoryValue === repositoryValue);
      if (repo && repo.events && repo.events[eventIndex]) {
        Ember.set(repo.events[eventIndex], '__activeTab', tabName);
      }
    },

    checkStatus: function (jobId, repositoryValue) {
      this.sendIntegrationMessage({
        action: 'CHECK_STATUS',
        data: { jobId: jobId, repositoryValue: repositoryValue }
      })
        .then((response) => {
          const results = this.get('repoResults') || [];
          const repo = results.find((r) => r.repositoryValue === repositoryValue);
          if (repo && response.done) {
            Ember.set(repo, 'done', true);
            Ember.set(repo, 'events', response.events || []);
            Ember.set(repo, 'jobId', null);
            this._initEventTabs(results);
            this._buildReadableJson(results);
            this._buildDisplayFields(results);
          }
        })
        .catch((err) => {
          this.set('block._state.error', (err && err.detail) || 'Status check failed.');
        });
    },

    cancelQuery: function (jobId, repositoryValue) {
      this.sendIntegrationMessage({
        action: 'CANCEL_QUERY',
        data: { jobId: jobId, repositoryValue: repositoryValue }
      })
        .then(() => {
          const results = this.get('repoResults') || [];
          const repo = results.find((r) => r.repositoryValue === repositoryValue);
          if (repo) {
            Ember.set(repo, 'done', true);
            Ember.set(repo, 'cancelled', true);
            Ember.set(repo, 'events', []);
          }
        })
        .catch((err) => {
          this.set('block._state.error', (err && err.detail) || 'Cancel failed.');
        });
    },

    toggleCreateCase: function () {
      this.set('block._state.showCreateCase', !this.get('block._state.showCreateCase'));
    },

    setCaseType: function (type) {
      this.set('block._state.caseType', type);
    },

    resetCase: function () {
      this.set('block._state.caseSuccess', null);
      this.set('block._state.caseError', null);
      const entityValue = (this.get('block.entity') || {}).value || '';
      this.set('block._state.caseTitle', entityValue);
      this.set('block._state.caseDescription', '');
      this.set('block._state.caseType', 'incident');
    },

    createCase: function () {
      const title = (this.get('block._state.caseTitle') || '').trim();
      const description = (this.get('block._state.caseDescription') || '').trim();
      const type = this.get('block._state.caseType') || 'incident';

      if (!title || !description) {
        this.set('block._state.caseError', 'Title and description are required.');
        return;
      }

      this.set('block._state.caseLoading', true);
      this.set('block._state.caseError', null);
      this.set('block._state.caseSuccess', null);

      const entity = this.get('block.entity');
      this.sendIntegrationMessage({
        action: 'CREATE_CASE',
        data: { title: title, description: description, type: type, entityValue: entity.value }
      })
        .then((response) => {
          this.set('block._state.caseLoading', false);
          this.set('block._state.caseSuccess', response);
        })
        .catch((err) => {
          this.set('block._state.caseLoading', false);
          this.set('block._state.caseError', (err && err.detail) || 'Failed to create case.');
        });
    },

    toggleAnnotateIncident: function () {
      this.set('block._state.showAnnotateIncident', !this.get('block._state.showAnnotateIncident'));
    },

    resetIncident: function () {
      this.set('block._state.incidentSuccess', null);
      this.set('block._state.incidentError', null);
      this.set('block._state.incidentId', '');
      this.set('block._state.incidentComment', '');
    },

    annotateIncident: function () {
      const incidentId = (this.get('block._state.incidentId') || '').trim();
      const comment = (this.get('block._state.incidentComment') || '').trim();

      if (!incidentId || !comment) {
        this.set('block._state.incidentError', 'Incident ID and comment are required.');
        return;
      }

      this.set('block._state.incidentLoading', true);
      this.set('block._state.incidentError', null);
      this.set('block._state.incidentSuccess', null);

      this.sendIntegrationMessage({
        action: 'ANNOTATE_INCIDENT',
        data: { incidentId: incidentId, comment: comment }
      })
        .then((response) => {
          this.set('block._state.incidentLoading', false);
          this.set('block._state.incidentSuccess', response);
        })
        .catch((err) => {
          this.set('block._state.incidentLoading', false);
          this.set('block._state.incidentError', (err && err.detail) || 'Failed to annotate incident.');
        });
    }
  }
});
