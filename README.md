# 6x0k Space 1.8.75.1

Diese Version basiert funktional auf dem neuen 1.8.75-Build und wurde anschließend bereinigt.

## Table of Contents

- [What's New in 1.8.75](#whats-new-in-1875)
- [Intentionally Removed](#intentionally-removed)

## What's New in 1.8.75

Compared to the previous 1.8.73.5 build, this release includes the following useful functionality and stability improvements:

### Autogramm / Greeting
- More reliable Autogramm/Greeting retry handling for temporary request failures.
- Smarter Autogramm cooldown handling instead of relying only on fixed delays.
- VIP/Membership detection for determining appropriate Autogramm wait times.
- Improved handling of cooldowns, daily limits, invalid greeting definitions, and temporary request errors.
- New Autogramm status and progress information, including sent count, target count, current state, and the next action.
- Background alarms for Autogramm timers, making scheduled actions more reliable when the browser suspends normal JavaScript timers.
- Improved state recovery and status updates when switching away from and back to the MSP2 tab.

### Performance & Data Loading
- Improved local caching for the D1, D2, and D3 data packs.
- Background D3 prefetch/warming so relevant data can be prepared before a feature is opened.
- A lightweight Home catalog to avoid loading full Home data unnecessarily.
- Full Home data is loaded on demand when a specific Home is actually needed.
- Improved Avatar/Face caching for profiles and users that are accessed repeatedly.
- More compact background data handling to reduce unnecessary processing.

### Account & Profile State
- Improved local account/profile state handling.
- Cleaner state management when switching between MSP2 accounts.
- Better local state handling for profiles and Autogramm targets.

These additions are focused on local functionality, reliability, and performance. No credential capture, token collection, external vendor synchronization, remote access gate, heartbeat/tracking, or external feedback functionality is included.

## Intentionally Removed

- Password/credential capture
- Keylogging
- Password/credential vault
- Refresh/access-token storage or transmission to a server
- `webRequest` request-body inspection
- External vendor synchronization
- Heartbeat/presence sent to third-party servers
- Remote gate / kill switch / forced updates
- External feedback system
- msp2soft.com references

The extension contains no external update lock or remote access restriction.

Project / Branding:
https://github.com/6x0k
