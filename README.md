# CrowdStrike Next-Gen SIEM

Polarity integration for **CrowdStrike Next-Gen SIEM (NG-SIEM)** — searches event data across Falcon LogScale repositories using the async query job API (`/humio/api/v1/repositories/<repo>/queryjobs`).

Analysts highlight any entity in Polarity (IP, domain, hash, hostname, CVE, etc.) and the integration runs a configurable CQL query against one or more NG-SIEM repositories, returning matching events directly in the overlay.

---

## Features

- **Open-query model**: Any Polarity entity type can be searched using a single configurable CQL template
- **Async query jobs**: POST → poll → return (respects API `pollAfter` hint)
- **Multi-repository search**: Run queries across All Events, Falcon, Third Party, IT Automation, or Forensics repositories
- **In-panel repository selector**: Toggle repositories and re-run queries without leaving the overlay
- **Cancel in-flight queries**: Cancel long-running jobs directly from the Polarity panel
- **Events displayed per repository**: Fields view, JSON view with syntax highlighting
- **Deep link**: One-click pivot into the Falcon NG-SIEM UI with the query pre-populated
- **On-demand only**: Integration only runs when manually triggered by the analyst

---

## Repositories

| Display Name   | API Value          | Description                                              |
|----------------|--------------------|----------------------------------------------------------|
| All Events     | `search-all`       | All event data from CrowdStrike and third-party sources  |
| Falcon         | `investigate_view` | Endpoint and sensor data                                 |
| Third Party    | `third-party`      | Data from external integrations                          |
| IT Automation  | `falcon_for_it_view` | Falcon IT module data                                  |
| Forensics      | `forensics_view`   | Falcon Forensics module data                             |

---

## Configuration

| Option | Type | Required | Default |
|--------|------|----------|---------|
| CrowdStrike API Token | Password | ✅ | — |
| Base URL | Text | ✅ | `https://api.crowdstrike.com` |
| Default Repositories | Text | ✅ | `search-all` |
| Query Template | Text | ✅ | `search "{{entity}}" \| head(10)` |
| Search Window | Text | ✅ | `24hours` |
| Deep Link URL Template | Text | — | See below |

### Query Template Tokens
- `{{entity}}` — the highlighted value (automatically quoted and escaped)

### Search Window Examples
- `1hour`, `24hours`, `7days`, `30days`

### Deep Link URL Template Tokens
- `{{repo}}` — repository value (URL-encoded)
- `{{entity}}` — highlighted entity value (URL-encoded)
- `{{query}}` — full CQL query string (URL-encoded)
- `{{start}}` — search window value (URL-encoded)

**Default:**
```
https://falcon.crowdstrike.com/investigate/events?repositoryName={{repo}}&query={{query}}&start={{start}}
```

---

## Installation

1. Clone the repository into your Polarity integrations directory:
   ```bash
   git clone https://github.com/polarityio/crowdstrike-ngsiem
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the integration in Polarity with your CrowdStrike API token and desired repositories.
4. Restart the Polarity server.

---

## Test Indicator

```
CVE-2022-38023
```

Also valid: any IP address, domain, hostname, MD5/SHA256 hash, or CrowdStrike Agent ID (32-char hex) known to be in your NG-SIEM telemetry.

---

## API Reference

- [CrowdStrike NG-SIEM API Docs](https://docs.crowdstrike.com/r/bda96fc1)
- [CrowdStrike Swagger UI](https://assets.falcon.crowdstrike.com/support/api/swagger.html#/ngsiem/StopSearchV1)

---

## Linear

[INT-1369 — CrowdStrike Next-Gen SIEM](https://linear.app/polarity/issue/INT-1369/crowdstrike-next-gen-siem)
