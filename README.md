# 6x0k Space 1.8.42

Merged the functional 1.8.42 app features into the privacy-clean build.

Included: PetClone, Homes Harvest/dynamic Home loading, dynamic Emoji Pack, StarQuiz, DM Spam Shield/Lockdown, Outfit Copy/Restore/Emergency, Avatar/Room image sync, Pet nickname UI and related state/cache improvements.

Privacy: keeps the clean background/bridge and does not include the vendor credential-vault, device binding, remote gate, heartbeat or vendor host permissions. Chrome webRequest is not enabled.

The app UI may still contain a clickable clickable “cleaned by 6x0k” label linking to GitHub; it does not create a network request by itself.

### 1.8.42 Performance Update

- Added local D3/emoji caching with `_d3Cached`.
- Added background D3 preloading with `_warmD3Background`.
- Added local pack text loading helper `_fetchPackText`.
- Added UI/service-worker yielding via `_yieldUi`.
- Added `xb:prefetch` support for local data packs.
- No vendor credential, telemetry, vault, heartbeat, remote gate, or external configuration functionality was added.


### Credits

**cleaned by 6x0k** — [GitHub](https://github.com/6x0k)


## 1.8.42 Clean Update

- Added the safe 1.8.42 local D3 durable-cache improvements.
- Added pack-ready notifications after local D3 data is warmed.
- Kept the existing 6x0k Space privacy-clean architecture unchanged.
- No `webRequest`, vendor vault, credential interception, telemetry, heartbeat, remote gate, kill-switch, or vendor host permissions were imported from upstream 1.8.42.
- Version is **1.8.42**.
