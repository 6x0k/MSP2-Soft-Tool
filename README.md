<div align="center">

# 6x0k Space

**Community tools for MovieStarPlanet 2**

`v1.8.86` · Manifest V3 · Chrome Extension

A feature-focused extension with profile utilities, messaging helpers, room tools,
customization options, and a **Ghost mode** for room entry.

</div>

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [What's New in 1.8.86](#whats-new-in-1886)
- [Ghost Mode](#ghost-mode)
- [Feature History](#feature-history)
- [Privacy and Security Notes](#privacy-and-security-notes)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Permissions](#permissions)
- [Development](#development)
- [Disclaimer](#disclaimer)

---

## Overview

**6x0k Space** is a community-made browser extension that adds a collection of
tools and interface enhancements to the MovieStarPlanet 2 web client.

This repository is a modified build based on selected upstream functionality.
Features depend on the current MSP2 website, its APIs, and the extension's
permissions; individual functions may stop working when the game changes.

> [!NOTE]
> 6x0k Space is an independent community project. It is not affiliated with,
> endorsed by, or sponsored by MovieStarPlanet or its owners.

## Features

### Profiles and players
- Profile information and player interaction utilities
- Outfit and avatar-related tools
- Autograph / greeting tools
- VIP and profile-state helpers
- Friend management and friend-request actions
- Friend cleanup and VIP friend filtering

### Chat and messaging
- Chat and direct-message utilities
- DM automation with configurable limits
- Incoming-message helpers
- Emoji tools and favorites
- Mood and status utilities

### Rooms and game helpers
- **Ghost Mode** for joining rooms invisibly, where supported by the game
- Home and room utilities
- Room animation tools and animation previews
- Emote browsing and category helpers
- Game and event-related helpers, including Dress Up workflow support

### Interface and personalization
- Custom panel backgrounds
- Image upload, resizing, and compression for supported backgrounds
- Theme and panel customization
- Local preferences and settings persistence
- Local data-pack caching and background prefetching

> Feature availability can vary with the current MSP2 client and server behavior.

## What's New in 1.8.86

### Ghost and Halloween-related functionality
- The build includes a **Ghost Mode** toggle for invisible room entry.
- The Ghost toggle's state is saved locally in the extension's settings.
- Halloween quest detection was expanded to recognize additional identifiers
  containing `coffin`, `spirit`, `skull`, `spook`, and `pumpkin`.
- Ghost collection handling was updated to process reward quantities and account
  for the daily target of 35 where the relevant collection workflow is available.

### Autograph / Greeting
- Improved retry handling for temporary request failures.
- More adaptive cooldown handling rather than relying only on fixed delays.
- VIP-aware wait-time handling.
- Improved handling of daily limits, invalid greeting definitions, and temporary errors.
- More detailed progress and status information.
- Background alarms help scheduled actions continue more reliably when browser
  timers are suspended.
- Improved state recovery when switching between MSP2 tabs.

### Performance and data loading
- Improved local caching for D1, D2, and D3 data packs.
- Background D3 prefetching to prepare data before a feature is opened.
- A lightweight Home catalog to avoid loading all Home data unnecessarily.
- Full Home data is loaded on demand.
- Improved Avatar/Face caching for repeatedly accessed profiles.
- More compact background data handling.

### Account and profile state
- Improved local profile-state handling.
- Cleaner state management when switching between MSP2 accounts.
- Better local state handling for profiles and Autograph targets.

## Ghost Mode

Ghost Mode is an in-panel toggle intended to let the user enter a room without
being shown to other players, while still allowing supported room interactions.

**How to use it**
1. Open MovieStarPlanet 2 and open the 6x0k Space panel.
2. Find the **Ghost** control in the relevant tools section.
3. Enable it before entering a room, or use the toggle as instructed by the UI.
4. Turn it off when you no longer need it.

The exact behavior depends on MSP2's current room/session implementation. The
toggle does not guarantee invisibility in every game version or every situation.

### Ghost collection / daily target

The updated collection logic handles reward quantities and checks progress toward
the daily target of **35 ghosts**. The related quest matcher also recognizes more
Halloween-themed identifiers. This describes the code's intended behavior; the
result should be verified in-game because event APIs and quest data can change.

## Feature History

### 1.8.73 — Selected upstream additions
- **Auto Dress Up:** assists with the Dress Up workflow and relevant round states.
- **Dress Up event handling:** handles challenge/outfit, ready-for-judgment,
  showoff, rating, round-end, and game-end states.
- **Outfit / Avatar color codes:** retrieves inventory-related data and exposes
  associated color values for inspection and copying.
- **Integrated feature UI:** adds access to the selected tools in the panel.

### 1.8.53 — Selected tools and interface additions
- Autograph auto-repeat with cooldown handling, counters, and limits
- VIP detection through MSP2 membership information
- Shop emote loading and categorization
- Room animation playback and animation previews
- Radar interface and supporting helpers
- Custom panel backgrounds, image resizing, and local persistence

The upstream **Feedback / Idea** tab is intentionally omitted from this build.

### 1.8.42 — Local caching and performance
- Persistent local D3 cache
- Pack-ready notification for active MSP2 tabs
- Improved background D3 warm-up
- Local-first data-pack loading and prefetch support

---

## Privacy and Security Notes

This project has been modified to remove selected upstream components that were
not required for the documented tool features. However, a README description is
not a substitute for a complete security audit.

Before using this extension with a real account, inspect the source code and
review its network requests, token/session handling, permissions, and any code
that runs in the page context. Only install builds you have independently
reviewed or trust.

The extension necessarily communicates with MSP2's own website/API endpoints
for features that interact with the game. Browser permissions and behavior may
change as the code evolves.

### Review checklist
- Confirm every requested permission is necessary.
- Review page-injected scripts and authentication/session handling.
- Inspect external network destinations and data sent to them.
- Re-test the extension after merging upstream changes.
- Do not treat “clean” in a filename or description as proof of safety.

## Installation

This project is distributed as an unpacked Chrome extension.

### 1. Download and extract
Download the ZIP archive and extract it to a folder on your computer.

### 2. Open Chrome Extensions
Navigate to:

```text
chrome://extensions/
```

### 3. Enable Developer mode
Turn on **Developer mode**.

### 4. Load the extension
Click **Load unpacked** and select the extracted project folder containing
`manifest.json`.

Do not select the ZIP file itself.

### 5. Open MSP2
Open MovieStarPlanet 2 and reload the page if it was already open. The panel
should appear after the game client has loaded, assuming the current client is
compatible.

## Project Structure

```text
6x0k Space/
├── app.js        # Main UI and feature logic
├── bg.js         # Manifest V3 background service worker
├── boot.js       # Initialization and page/extension bridge
├── stub.js       # Page-side session/authentication bridge; review carefully
├── d1.json       # Local extension data
├── d2.json       # Local extension data
├── d3.json       # Local extension data
├── manifest.json # Extension configuration and permissions
├── README.md     # Project documentation
└── .gitignore    # Git ignore rules
```

## Permissions

The manifest currently requests the following permissions:

| Permission | General purpose |
|---|---|
| `storage` | Save extension settings and local state |
| `scripting` | Register or inject scripts where permitted |
| `debugger` | Support browser/game interaction features using DevTools Protocol |
| `clipboardWrite` | Allow supported copy-to-clipboard features |
| `alarms` | Schedule background tasks such as timers |

Host permissions cover MSP2-related domains used by the extension. Always check
`manifest.json` before installing and verify that the current permission list
matches the features you intend to use.

## Development

The extension uses **Manifest V3** and primarily plain JavaScript.

Suggested review steps before publishing a build:

1. Compare the source against the intended upstream version.
2. Review changed JavaScript and manifest permissions.
3. Check for unexpected external URLs, token handling, or data collection.
4. Test core features in a non-sensitive test environment.
5. Update this README and the changelog whenever behavior changes.

## Disclaimer

This project is provided for educational and personal-use purposes. Use it at
your own discretion and follow the game's terms and applicable rules. The
authors make no guarantee that every feature will remain compatible with future
MSP2 updates.

---

<div align="center">

**6x0k Space** · Community project

</div>
