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
        // Query
        isQuerying: false,
        error: null,
        repoVisibility: repoVisibility,

        // Cases panel
        showCases: false,
        casesLoading: false,
        casesLoaded: false,
        casesError: null,
        casesResults: [],

        // Create new case form (nested inside Cases panel)
        showCreateCase: false,
        caseTitle: entityValue,
        caseDescription: '',
        caseLoading: false,
        caseError: null,
        caseSuccess: null,

        // Incidents panel
        showIncidents: false,
        incidentsLoading: false,
        incidentsLoaded: false,
        incidentsError: null,
        incidentsResults: [],

        // Inline annotation form (one at a time — tracks which incident is expanded)
        expandedIncidentId: null,
        incidentComment: '',
        incidentLoading: false,
        incidentError: null,
        incidentSuccess: null   // stores incidentId string on success
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

    // ── Cases panel ─────────────────────────────────────────────────────────

    toggleCases: function () {
      const nowOpen = !this.get('block._state.showCases');
      this.set('block._state.showCases', nowOpen);

      // Lazy-load: search only on first expand
      if (nowOpen && !this.get('block._state.casesLoaded') && !this.get('block._state.casesLoading')) {
        this.set('block._state.casesLoading', true);
        this.set('block._state.casesError', null);

        const entity = this.get('block.entity');
        this.sendIntegrationMessage({
          action: 'SEARCH_CASES',
          data: { entityValue: entity.value }
        })
          .then((response) => {
            this.set('block._state.casesLoading', false);
            this.set('block._state.casesLoaded', true);
            this.set('block._state.casesResults', response.cases || []);
          })
          .catch((err) => {
            this.set('block._state.casesLoading', false);
            this.set('block._state.casesError', (err && err.detail) || 'Failed to search cases.');
          });
      }
    },

    refreshCases: function () {
      this.set('block._state.casesLoading', true);
      this.set('block._state.casesLoaded', false);
      this.set('block._state.casesError', null);

      const entity = this.get('block.entity');
      this.sendIntegrationMessage({
        action: 'SEARCH_CASES',
        data: { entityValue: entity.value }
      })
        .then((response) => {
          this.set('block._state.casesLoading', false);
          this.set('block._state.casesLoaded', true);
          this.set('block._state.casesResults', response.cases || []);
        })
        .catch((err) => {
          this.set('block._state.casesLoading', false);
          this.set('block._state.casesError', (err && err.detail) || 'Failed to search cases.');
        });
    },

    toggleCreateCase: function () {
      this.set('block._state.showCreateCase', !this.get('block._state.showCreateCase'));
    },

    resetCase: function () {
      this.set('block._state.caseSuccess', null);
      this.set('block._state.caseError', null);
      const entityValue = (this.get('block.entity') || {}).value || '';
      this.set('block._state.caseTitle', entityValue);
      this.set('block._state.caseDescription', '');
    },

    createCase: function () {
      const title = (this.get('block._state.caseTitle') || '').trim();
      const description = (this.get('block._state.caseDescription') || '').trim();

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
        data: { title: title, description: description, type: 'incident', entityValue: entity.value }
      })
        .then((response) => {
          this.set('block._state.caseLoading', false);
          this.set('block._state.caseSuccess', response);
          // Invalidate cache so next expand refreshes the list
          this.set('block._state.casesLoaded', false);
        })
        .catch((err) => {
          this.set('block._state.caseLoading', false);
          this.set('block._state.caseError', (err && err.detail) || 'Failed to create case.');
        });
    },

    // ── Incidents panel ──────────────────────────────────────────────────────

    toggleIncidents: function () {
      const nowOpen = !this.get('block._state.showIncidents');
      this.set('block._state.showIncidents', nowOpen);

      // Lazy-load: search only on first expand
      if (nowOpen && !this.get('block._state.incidentsLoaded') && !this.get('block._state.incidentsLoading')) {
        this.set('block._state.incidentsLoading', true);
        this.set('block._state.incidentsError', null);

        const entity = this.get('block.entity');
        this.sendIntegrationMessage({
          action: 'SEARCH_INCIDENTS',
          data: { entityValue: entity.value }
        })
          .then((response) => {
            this.set('block._state.incidentsLoading', false);
            this.set('block._state.incidentsLoaded', true);
            this.set('block._state.incidentsResults', response.incidents || []);
          })
          .catch((err) => {
            this.set('block._state.incidentsLoading', false);
            this.set('block._state.incidentsError', (err && err.detail) || 'Failed to search incidents.');
          });
      }
    },

    refreshIncidents: function () {
      this.set('block._state.incidentsLoading', true);
      this.set('block._state.incidentsLoaded', false);
      this.set('block._state.incidentsError', null);
      this.set('block._state.expandedIncidentId', null);

      const entity = this.get('block.entity');
      this.sendIntegrationMessage({
        action: 'SEARCH_INCIDENTS',
        data: { entityValue: entity.value }
      })
        .then((response) => {
          this.set('block._state.incidentsLoading', false);
          this.set('block._state.incidentsLoaded', true);
          this.set('block._state.incidentsResults', response.incidents || []);
        })
        .catch((err) => {
          this.set('block._state.incidentsLoading', false);
          this.set('block._state.incidentsError', (err && err.detail) || 'Failed to search incidents.');
        });
    },

    toggleIncidentAnnotate: function (incidentId) {
      const current = this.get('block._state.expandedIncidentId');
      if (current === incidentId) {
        this.set('block._state.expandedIncidentId', null);
      } else {
        this.set('block._state.expandedIncidentId', incidentId);
        // Reset form state when switching incidents
        this.set('block._state.incidentComment', '');
        this.set('block._state.incidentError', null);
        this.set('block._state.incidentSuccess', null);
      }
    },

    annotateIncident: function (incidentId) {
      const comment = (this.get('block._state.incidentComment') || '').trim();

      if (!comment) {
        this.set('block._state.incidentError', 'Please enter a comment or note.');
        return;
      }

      this.set('block._state.incidentLoading', true);
      this.set('block._state.incidentError', null);
      this.set('block._state.incidentSuccess', null);

      this.sendIntegrationMessage({
        action: 'ANNOTATE_INCIDENT',
        data: { incidentId: incidentId, comment: comment }
      })
        .then(() => {
          this.set('block._state.incidentLoading', false);
          this.set('block._state.incidentSuccess', incidentId);
        })
        .catch((err) => {
          this.set('block._state.incidentLoading', false);
          this.set('block._state.incidentError', (err && err.detail) || 'Failed to annotate incident.');
        });
    }
  }
});
