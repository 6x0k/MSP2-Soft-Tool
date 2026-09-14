# MSP2TOOL

<p align="center">
  <strong>MSP2TOOL</strong><br>
  <sub>Cleaned by Mado · v.1.0</sub>
</p>

<p align="center">
  A cleaned and privacy-focused Chrome extension for MovieStarPlanet 2.
</p>

---

## Table of Contents

- [About](#about)
- [What's included](#whats-included)
- [What's New in 1.8.42](#whats-new-in-1842)
- [Privacy cleanup](#privacy-cleanup)
- [Installation](#installation)
- [Repository structure](#repository-structure)
- [File responsibilities](#file-responsibilities)
- [Permissions](#permissions)
- [Changelog](#changelog)
- [Security & transparency](#security--transparency)
- [Development](#development)
- [Disclaimer](#disclaimer)

## About

**MSP2TOOL** is a browser extension that adds a collection of tools and automation features to the MovieStarPlanet 2 web client.

This repository contains a cleaned version of the extension. The goal of this build is to remove the parts that were unrelated to the normal tool functionality — especially credential collection, telemetry, hardware fingerprinting, external synchronization and remote control mechanisms.

The extension still communicates with the official MSP2 game/API infrastructure where required for its actual features.

> **Important:** MSP2TOOL is an independent community project and is not affiliated with, endorsed by, or sponsored by MovieStarPlanet or its owners.

---

## What's included

The extension provides a large in-game tool panel with functionality around:

- Profile information and profile interactions
- Friends management
- Friend request actions
- Auto-Liker functionality
- Chat and messaging tools
- DM automation
- DM spam controls and configurable limits
- Automatic friend handling
- Friend cleanup tools
- VIP friend filtering
- Mood management
- Status/profile utilities
- Emoji tools and emoji favorites
- Home/room utilities
- Outfit and profile-related tools
- Autograph-related functionality
- Player interaction utilities
- Game/event-related helpers
- UI customization and preferences
- Theme and panel customization
- Local settings persistence
- Changelog / privacy information

The exact availability of individual features can depend on the current MSP2 client and its APIs.

---

# What's New in 1.8.42

Version **1.8.42** adds selected local performance and data-loading improvements while keeping the privacy-clean architecture unchanged.

### Durable D3 Cache

D3 data can now be kept in a persistent local browser cache using the extension's local `CacheStorage`.

This adds:

- `_readDurableD3Text()`
- `_writeDurableD3Text()`

The cache is used as a local-first source for D3 data and can survive service-worker restarts. If the cache is unavailable or invalid, the extension falls back to its bundled local D3 data.

### Pack Ready Notification

A new `_notifyPackReady()` helper can notify active MSP2 tabs when the local data pack has finished loading.

The notification uses:

```text
xb:packReady
```

This allows the UI to react to locally prepared data without unnecessary repeated loading.

### Improved D3 Warm-Up

The existing background warm-up has been extended to make use of the durable local cache.

The extension can prepare D3 data in the background before a feature needs it, reducing loading delays while keeping the operation local.

### Local-First Pack Loading

The pack-loading path now follows a local-first strategy:

```text
Persistent D3 cache
        ↓
In-memory cache
        ↓
Bundled d3.json
```

No third-party vendor service is required for these improvements.

### `xb:prefetch`

The existing `xb:prefetch` path remains available for preparing local data ahead of time. This works together with the D3 cache and background warm-up improvements.

### Privacy

Only the useful 1.8.42 local caching and performance changes were added.

The following upstream functionality remains excluded:

- Credential/password interception
- Credential queues
- Vendor vault uploads
- Account/token synchronization to third-party servers
- Hardware/device fingerprinting
- Heartbeat/presence reporting
- IP collection for vendor telemetry
- Remote configuration
- Remote kill-switches
- Forced remote version checks
- Vendor feedback uploads
- Vendor telemetry
- Third-party vendor host permissions
- `webRequest`

The build therefore remains **privacy-clean** while gaining the selected 1.8.42 improvements.

---

# Privacy cleanup

The main purpose of this release is the removal of functionality that could collect or transmit information unrelated to the extension's normal operation.

### Removed

| Component | Status |
|---|---|
| Password interception | Removed |
| Password storage/queuing | Removed |
| External credential vault upload | Removed |
| Account/token synchronization to third-party servers | Removed |
| Hardware fingerprinting | Removed |
| PC identification collection | Removed |
| CPU/RAM/GPU collection | Removed |
| Screen-resolution collection | Removed |
| Browser/system metadata collection | Removed |
| Heartbeat / presence reporting | Removed |
| External IP lookup | Removed |
| Remote feedback upload | Removed |
| Remote configuration fetching | Removed |
| Remote kill-switch | Removed |
| Forced remote version checks | Removed |
| Third-party host permissions | Removed |
| `webRequest` permission | Removed |
| Vendor telemetry | Removed |

### What remains

The extension still needs access to MSP2's own web/API infrastructure for features that actually interact with the game.

The extension also handles the current MSP2 authentication token **locally in the browser**, because the tool needs the active game session to perform authenticated functionality. The cleaned build does not intentionally send that token to the removed third-party vault/telemetry infrastructure.

The `debugger` permission is still present because parts of the tool use Chrome DevTools Protocol functionality for browser/game interaction.

---

# Installation

MSP2TOOL is currently distributed as an unpacked Chrome extension.

### 1. Download the repository

Clone the repository:

```bash
git clone https://github.com/6x0k/MSP2-Soft-Tool.git
```

Or download the repository as a ZIP from GitHub and extract it.

### 2. Open Chrome Extensions

Open:

```text
chrome://extensions/
```

### 3. Enable Developer Mode

Turn on **Developer mode** in the top-right corner.

### 4. Load the extension

Click:

**Load unpacked**

Select the folder containing:

```text
manifest.json
app.js
bg.js
boot.js
stub.js
d1.json
d2.json
d3.json
```

Do **not** select the ZIP file itself. Select the extracted project folder.

### 5. Open MovieStarPlanet 2

Open the MSP2 website and reload the page if it was already open.

The MSP2TOOL panel should become available once the game has loaded.

---

# Repository structure

```text
MSP2TOOL/
├── app.js          # Main UI and tool functionality
├── bg.js           # Manifest V3 background service worker
├── boot.js         # Page ↔ extension bridge / initialization
├── stub.js         # Local authentication-token bridge
├── d1.json         # Extension data
├── d2.json         # Extension data
├── d3.json         # Extension data
├── manifest.json   # Chrome extension manifest and permissions
├── README.md       # Project documentation
└── .gitignore      # Git ignore rules
```

## File responsibilities

### `manifest.json`

Defines the Chrome extension configuration, including:

- Extension name and version
- Manifest V3 configuration
- Background service worker
- Required Chrome permissions
- MSP2 host permissions

The cleaned build uses only the permissions needed by the remaining extension architecture:

```text
storage
scripting
debugger
```

### `bg.js`

The background service worker handles extension-side functionality such as:

- Chrome runtime messaging
- Script registration/injection
- MSP2 page interaction
- Chrome DevTools Protocol / debugger functionality
- Local extension state

The previous external vault, heartbeat, telemetry, remote configuration and credential handlers have been removed.

### `boot.js`

Responsible for initializing the page-side bridge and communicating between the MSP2 page and the extension.

The previous hardware collection and heartbeat logic has been removed.

### `stub.js`

A lightweight page-side authentication bridge.

It exposes the active MSP2 session token locally so the extension can perform authenticated game functionality.

It does **not** contain the previous password-capture, IP-lookup, telemetry or third-party upload functionality.

### `app.js`

The main extension code.

This contains the UI, settings, MSP2 API interaction and the majority of the actual tool functionality.

---

# Permissions

The current manifest requests:

### `storage`

Used for local extension settings and state.

### `scripting`

Used to register/inject the extension's scripts into the MSP2 pages.

### `debugger`

Used by parts of the tool that interact with the MSP2 page through Chrome's DevTools Protocol.

This is a powerful browser permission, so users should only install the extension from a source they trust.

### Host permissions

The extension is restricted to MSP2-related domains required by its functionality, including:

```text
moviestarplanet2.com
*.moviestarplanet2.com
*.mspapis.com
```

The previous third-party telemetry/vendor domains are no longer present in the manifest.

---

# Changelog

## v.1.0 — Cleaned by Mado

This release is based on the original extension and removes the following functionality:

### Credential handling

- Removed password interception from login requests.
- Removed password extraction from request bodies.
- Removed password queues.
- Removed password persistence used by the previous credential system.
- Removed external credential-vault uploads.

### Account and token data

- Removed third-party account synchronization.
- Removed external transmission of account/session information.
- Removed the previous sensitive `__xbSync` flow.
- Kept only the local authentication-token bridge required for normal MSP2 functionality.

### Hardware and device tracking

Removed collection of:

- PC identifiers
- CPU information
- RAM information
- GPU information
- Screen resolution
- Browser metadata
- Operating-system metadata
- Timezone/system metadata
- User-agent based hardware/profile information

### Heartbeat and presence

- Removed background heartbeat requests.
- Removed remote presence reporting.
- Removed periodic third-party status updates.

### IP collection

- Removed the external IP lookup.
- Removed the previous IP address from synchronization payloads.

### Remote control

- Removed remote configuration polling.
- Removed remote enable/disable configuration.
- Removed the remote kill-switch.
- Removed forced remote version/update checks.

### Feedback and telemetry

- Removed remote feedback uploads.
- Removed vendor telemetry endpoints.
- Removed the previous third-party feedback/synchronization paths.

### Browser permissions

- Removed the `webRequest` permission that was previously used for request inspection.
- Removed unnecessary third-party host permissions.

---

# Security & transparency

This project is intended to make the extension easier to inspect and safer to use than the original build.

If you are auditing the source, useful places to start are:

```text
manifest.json
bg.js
boot.js
stub.js
app.js
```

In particular, `manifest.json` shows the permissions and network scope, while `bg.js`, `boot.js` and `stub.js` contain the extension/background/page communication architecture.

For a deeper audit, search the source for:

```text
chrome.storage
chrome.scripting
chrome.debugger
fetch(
XMLHttpRequest
Authorization
Bearer
accessToken
refreshToken
```

The cleaned build intentionally still contains MSP2 API communication because removing all network communication would also remove many of the actual tool's features.

---

# Development

There is no Node.js build step required for the current unpacked extension.

After changing source files:

1. Open `chrome://extensions/`
2. Find **MSP2TOOL**
3. Click **Reload**
4. Refresh the MSP2 page

For JavaScript syntax checks:

```bash
node --check app.js
node --check bg.js
node --check boot.js
node --check stub.js
```

---

# Disclaimer

This project is provided for educational and personal use.

MovieStarPlanet, MSP2 and related trademarks belong to their respective owners. This project is not affiliated with or endorsed by them.

Use browser automation and game-related functionality responsibly and at your own risk. Game rules, APIs and client behavior may change without notice.

---

<p align="center">
  <sub>MSP2TOOL · Cleaned by Mado · v.1.0</sub>
</p>
