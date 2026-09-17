# 6x0k Space

<p align="center">
  <strong>6x0k Space</strong><br>
  <sub>Cleaned by 6x0k · v.1.8.53</sub>
</p>

<p align="center">
  A cleaned and privacy-focused Chrome extension for MovieStarPlanet 2.
</p>

---

## Table of Contents

- [About](#about)
- [What's included](#whats-included)
- [What's New in 1.8.53](#whats-new-in-1853)
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

**6x0k Space** is a browser extension that adds a collection of tools and automation features to the MovieStarPlanet 2 web client.

This repository contains a cleaned version of the extension. The goal of this build is to remove the parts that were unrelated to the normal tool functionality — especially credential collection, telemetry, hardware fingerprinting, external synchronization and remote control mechanisms.

The extension still communicates with the official MSP2 game/API infrastructure where required for its actual features.

> **Important:** 6x0k Space is an independent community project and is not affiliated with, endorsed by, or sponsored by MovieStarPlanet or its owners.

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

# What's New in 1.8.53

Version **1.8.53** brings the selected feature and UI additions from the upstream 1.8.53 release into the clean 6x0k Space build. The feature layer was merged without restoring the upstream vendor telemetry, credential-vault, remote-control or `webRequest` systems.

### What's new

| Feature | Description | Status |
|---|---|---|
| Autographer Auto-Repeat | Repeats greeting/autograph actions with cooldown handling, counters and configurable limits. | Included |
| VIP Detection | Checks the MSP2 membership summary to determine current VIP status. | Included |
| Shop Emotes | Loads and parses MSP2 shop emote listings and merges refreshed data with existing local properties. | Included |
| Emote Categories | Organizes emotes into sitting, dances, posing and basic categories. | Included |
| Room Animations | Plays room animations using the current room/session information. | Included |
| Animation Preview | Adds animation-sheet/grid rendering and preview playback. | Included |
| Radar | Adds the 1.8.53 radar functionality and related UI. | Included |
| Custom Panel Backgrounds | Allows a custom panel background using a local image or supported URL. | Included |
| Image Upload & Compression | Reads local images and compresses/resizes large images before storing them. | Included |
| Persistent Background Storage | Persists panel backgrounds locally with IndexedDB/local storage. | Included |
| Background UI Sync | Synchronizes background state with the panel UI. | Included |

### Autographer Auto-Repeat

The autographer can repeat greeting actions while respecting cooldowns and tracking the number of sends. A configurable maximum can limit repetitions; a maximum of `0` is treated as unlimited by the upstream feature logic.

### VIP Detection

The new VIP helper uses the MSP2 membership-summary API to inspect membership information such as the current tier and expiry. This is a direct MSP2 API feature and does not require the removed vendor infrastructure.

### Shop Emotes

1.8.53 adds a shop-inventory loader that can process multiple pages of MSP2 emote listings. The parser categorizes emotes and preserves compatible properties already stored locally.

### Room Animations & Animation Preview

New helpers resolve the current session, play room animations and provide an animation-sheet/grid preview for the available animation data.

### Custom Panel Backgrounds

Panel backgrounds can be supplied as local images or supported image URLs. Large images are resized and compressed before being persisted. The clean build keeps this background data locally instead of uploading it to a vendor service.

### Radar

The 1.8.53 radar UI and supporting helpers are included in the clean build.

### Removed from the clean UI

The upstream **Feedback / Idea** tab is intentionally not included in 6x0k Space. The rest of the selected 1.8.53 feature additions remain available.

### Privacy boundary

The 1.8.53 feature merge does **not** restore the upstream privacy-sensitive background systems. The clean build continues to exclude credential/password interception, vendor vault uploads, third-party account synchronization, hardware/device fingerprinting, heartbeat/presence reporting, external IP telemetry, remote configuration, remote kill-switches, forced remote version checks, vendor feedback uploads and `webRequest`.

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

6x0k Space is currently distributed as an unpacked Chrome extension.

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

The 6x0k Space panel should become available once the game has loaded.

---

# Repository structure

```text
6x0k Space/
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

## v.1.8.53 — Cleaned by 6x0k

### Added

- Autographer Auto-Repeat with cooldown handling, counters and configurable limits.
- VIP detection using the MSP2 membership-summary API.
- MSP2 shop emote loading and parsing.
- Emote categorization for sitting, dances, posing and basic groups.
- Room animation playback helpers.
- Animation-sheet/grid preview and playback.
- Radar functionality and UI.
- Custom panel backgrounds.
- Local image and supported URL background input.
- Image resizing/compression for large panel backgrounds.
- Local persistent background storage using IndexedDB/local storage.
- Background UI synchronization.

### Removed from the clean UI

- Feedback / Idea tab.

### Privacy

The new 1.8.53 feature layer was merged without restoring the upstream vendor credential, telemetry, heartbeat, device-fingerprint, remote-gate or `webRequest` systems.


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
2. Find **6x0k Space**
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
  <sub>6x0k Space · Cleaned by 6x0k · v.1.8.53</sub>
</p>
