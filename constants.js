'use strict';

const REPOSITORIES = [
  { label: 'All Events', value: 'search-all' },
  { label: 'Falcon', value: 'investigate_view' },
  { label: 'Third Party', value: 'third-party' },
  { label: 'IT Automation', value: 'falcon_for_it_view' },
  { label: 'Forensics', value: 'forensics_view' }
];

// Server-side poll budget per query job
const MAX_POLL_ATTEMPTS = 6;
const POLL_INTERVALS_MS = [500, 1000, 2000, 3000, 4000, 5000];

module.exports = { REPOSITORIES, MAX_POLL_ATTEMPTS, POLL_INTERVALS_MS };
