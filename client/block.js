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
      // Initialize per-repo visibility state — all visible by default
      const repoVisibility = {};
      (this.get('repoResults') || []).forEach((r) => {
        repoVisibility[r.repositoryValue] = true;
      });
      this.set('block._state', {
        isQuerying: false,
        error: null,
        repoVisibility
      });
    }
    this._initEventTabs(this.get('repoResults') || []);
    this._buildReadableJson(this.get('repoResults') || []);
    this._buildDisplayFields(this.get('repoResults') || []);
  },

  _initEventTabs(repoResults) {
    (repoResults || []).forEach((repo) => {
      (repo.events || []).forEach((event) => {
        if (!event.__activeTab) {
          Ember.set(event, '__activeTab', 'fields');
        }
      });
    });
  },

  // Priority fields shown first in the Fields tab, with friendly labels
  _PRIORITY_KEYS: [
    { key: '__formattedTimestamp', label: 'Timestamp' },
    { key: '#event_simpleName', label: 'Event Type' },
    { key: 'ComputerName', label: 'ComputerName' },
    { key: 'LocalAddressIP4', label: 'Local IP' },
    { key: 'aip', label: 'External IP' },
    { key: 'aid', label: 'Agent ID' },
    { key: 'event_platform', label: 'Platform' }
  ],

  _buildDisplayFields(repoResults) {
    const priorityKeys = this._PRIORITY_KEYS;
    const priorityKeySet = new Set(priorityKeys.map((p) => p.key));

    (repoResults || []).forEach((repo) => {
      (repo.events || []).forEach((event) => {
        const fields = [];

        // Priority fields first
        priorityKeys.forEach(({ key, label }) => {
          if (event[key] !== undefined && event[key] !== null && event[key] !== '') {
            fields.push({ key: label, value: String(event[key]) });
          }
        });

        // Remaining non-__ fields, skipping @timestamp (shown via __formattedTimestamp)
        const skipKeys = new Set([...priorityKeySet, '@timestamp', 'timestamp', 'UTCTimestamp', '#event_simpleName']);
        Object.keys(event).forEach((k) => {
          if (!k.startsWith('__') && !skipKeys.has(k)) {
            fields.push({ key: k, value: String(event[k]) });
          }
        });

        Ember.set(event, '__displayFields', fields);
      });
    });
  },

  _buildReadableJson(repoResults) {
    (repoResults || []).forEach((repo) => {
      (repo.events || []).forEach((event) => {
        const clean = {};
        Object.keys(event).forEach((k) => {
          if (!k.startsWith('__')) {
            clean[k] = event[k];
          }
        });
        Ember.set(event, '__jsonHighlighted', this._syntaxHighlight(JSON.stringify(clean, null, 2)));
      });
    });
  },

  _syntaxHighlight(json) {
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
    toggleRepoVisibility(repoValue) {
      const key = `block._state.repoVisibility.${repoValue}`;
      this.set(key, !this.get(key));
    },

    runQuery() {
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

          // Initialize visibility for any new repos returned
          const visibility = this.get('block._state.repoVisibility') || {};
          (response.repoResults || []).forEach((r) => {
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

    changeTab(tabName, repositoryValue, eventIndex) {
      const results = this.get('repoResults') || [];
      const repo = results.find((r) => r.repositoryValue === repositoryValue);
      if (repo && repo.events && repo.events[eventIndex]) {
        Ember.set(repo.events[eventIndex], '__activeTab', tabName);
      }
    },

    checkStatus(jobId, repositoryValue) {
      this.sendIntegrationMessage({
        action: 'CHECK_STATUS',
        data: { jobId, repositoryValue }
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

    cancelQuery(jobId, repositoryValue) {
      this.sendIntegrationMessage({
        action: 'CANCEL_QUERY',
        data: { jobId, repositoryValue }
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
    }
  }
});


  _initEventTabs(repoResults) {
    (repoResults || []).forEach((repo) => {
      (repo.events || []).forEach((event) => {
        if (!event.__activeTab) {
          Ember.set(event, '__activeTab', 'fields');
        }
      });
    });
  },

  // Priority fields shown first in the Fields tab, with friendly labels
  _PRIORITY_KEYS: [
    { key: '__formattedTimestamp', label: 'Timestamp' },
    { key: '#event_simpleName', label: 'Event Type' },
    { key: 'ComputerName', label: 'ComputerName' },
    { key: 'LocalAddressIP4', label: 'Local IP' },
    { key: 'aip', label: 'External IP' },
    { key: 'aid', label: 'Agent ID' },
    { key: 'event_platform', label: 'Platform' }
  ],

  _buildDisplayFields(repoResults) {
    const priorityKeys = this._PRIORITY_KEYS;
    const priorityKeySet = new Set(priorityKeys.map((p) => p.key));

    (repoResults || []).forEach((repo) => {
      (repo.events || []).forEach((event) => {
        const fields = [];

        // Priority fields first
        priorityKeys.forEach(({ key, label }) => {
          if (event[key] !== undefined && event[key] !== null && event[key] !== '') {
            fields.push({ key: label, value: String(event[key]) });
          }
        });

        // Remaining non-__ fields, skipping @timestamp (shown via __formattedTimestamp)
        const skipKeys = new Set([...priorityKeySet, '@timestamp', 'timestamp', 'UTCTimestamp', '#event_simpleName']);
        Object.keys(event).forEach((k) => {
          if (!k.startsWith('__') && !skipKeys.has(k)) {
            fields.push({ key: k, value: String(event[k]) });
          }
        });

        Ember.set(event, '__displayFields', fields);
      });
    });
  },

  _buildReadableJson(repoResults) {
    (repoResults || []).forEach((repo) => {
      (repo.events || []).forEach((event) => {
        const clean = {};
        Object.keys(event).forEach((k) => {
          if (!k.startsWith('__')) {
            clean[k] = event[k];
          }
        });
        Ember.set(event, '__jsonHighlighted', this._syntaxHighlight(JSON.stringify(clean, null, 2)));
      });
    });
  },

  _syntaxHighlight(json) {
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
    toggleSection(section) {
      const key = `block._state.show${section}`;
      this.set(key, !this.get(key));
    },

    toggleRepo(repoValue) {
      const key = `block._state.selectedRepos.${repoValue}`;
      this.set(key, !this.get(key));
    },

    runQuery() {
      this.set('block._state.error', null);

      const selectedRepos = Object.entries(this.get('block._state.selectedRepos') || {})
        .filter(([, checked]) => checked)
        .map(([value]) => value);

      if (!selectedRepos.length) {
        this.set('block._state.error', 'Please select at least one repository.');
        return;
      }

      this.set('block._state.isQuerying', true);

      const entity = this.get('block.entity');
      this.sendIntegrationMessage({
        action: 'RUN_QUERY',
        data: { entityValue: entity.value, entityType: entity.type, selectedRepos }
      })
        .then((response) => {
          this.set('block._state.isQuerying', false);
          this.set('block.data.details.repoResults', response.repoResults);
          if (response.deepLink) this.set('block.data.details.deepLink', response.deepLink);
          if (response.query) this.set('block.data.details.query', response.query);
          this._initEventTabs(response.repoResults);
          this._buildReadableJson(response.repoResults);
        })
        .catch((err) => {
          this.set('block._state.isQuerying', false);
          this.set('block._state.error', (err && err.detail) || 'Query failed. Please try again.');
        });
    },

    changeTab(tabName, repositoryValue, eventIndex) {
      const results = this.get('repoResults') || [];
      const repo = results.find((r) => r.repositoryValue === repositoryValue);
      if (repo && repo.events && repo.events[eventIndex]) {
        Ember.set(repo.events[eventIndex], '__activeTab', tabName);
      }
    },

    checkStatus(jobId, repositoryValue) {
      this.sendIntegrationMessage({
        action: 'CHECK_STATUS',
        data: { jobId, repositoryValue }
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
          }
        })
        .catch((err) => {
          this.set('block._state.error', (err && err.detail) || 'Status check failed.');
        });
    },

    cancelQuery(jobId, repositoryValue) {
      this.sendIntegrationMessage({
        action: 'CANCEL_QUERY',
        data: { jobId, repositoryValue }
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
    }
  }
});
