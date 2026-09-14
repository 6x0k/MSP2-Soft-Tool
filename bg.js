// ─── Service Worker ───────────────────────────────────────────────────────
// Registers content scripts dynamically (no static entries in the manifest).
// Serves data packs (d1/d2/d3) to the isolated bridge on demand.
// CDP input (chrome.debugger) for Unity WebGL trusted clicks/keys.
//
// File names are intentionally neutral (share-safe).

const HOST_MATCHES = [
  'https://moviestarplanet2.com/*',
  'https://*.moviestarplanet2.com/*',
];

/** Neutral pack layout (flat share folder OR dist/ under toolkit). */
const PACK = {
  app: 'app.js',
  boot: 'boot.js',
  stub: 'stub.js',
  d1: 'd1.json',
  d2: 'd2.json',
  d3: 'd3.json',
};

const ID_ISO  = 'cs-iso';
const ID_MAIN = 'cs-main';
const ID_WATCH = 'cs-watch';
const ID_STUB = 'cs-stub';

let MAIN_FILES = [`dist/${PACK.app}`];
let ISO_FILES = [`dist/${PACK.boot}`];
let STUB_FILES = [`dist/${PACK.stub}`];
let _layoutReady = null;

async function resolvePackLayout() {
  if (_layoutReady) return _layoutReady;
  _layoutReady = (async () => {
    // Prefer flat package root (friend share folder)
    try {
      const r = await fetch(chrome.runtime.getURL(PACK.app));
      if (r.ok) {
        MAIN_FILES = [PACK.app];
        ISO_FILES = [PACK.boot];
        STUB_FILES = [PACK.stub];
        return 'flat';
      }
    } catch { /* fall through */ }
    MAIN_FILES = [`dist/${PACK.app}`];
    ISO_FILES = [`dist/${PACK.boot}`];
    STUB_FILES = [`dist/${PACK.stub}`];
    return 'dist';
  })();
  return _layoutReady;
}

/** @type {Set<number>} */
const _dbgAttached = new Set();

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function _dbgTarget(tabId) {
  return { tabId };
}

async function _dbgAttach(tabId) {
  if (_dbgAttached.has(tabId)) return true;
  try {
    await chrome.debugger.attach(_dbgTarget(tabId), '1.3');
    _dbgAttached.add(tabId);
    return true;
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (/already attached/i.test(msg)) {
      _dbgAttached.add(tabId);
      return true;
    }
    throw e;
  }
}

async function _dbgDetach(tabId) {
  if (!_dbgAttached.has(tabId)) {
    try { await chrome.debugger.detach(_dbgTarget(tabId)); } catch { /* ignore */ }
    return true;
  }
  try {
    await chrome.debugger.detach(_dbgTarget(tabId));
  } catch { /* ignore */ }
  _dbgAttached.delete(tabId);
  return true;
}

async function _dbgSend(tabId, method, params) {
  return chrome.debugger.sendCommand(_dbgTarget(tabId), method, params || {});
}

/** CDP viewport coords (CSS px) — trusted mouse click for Unity canvas.
 *  Caller must measure x/y AFTER attach (debugger infobar shifts layout). */
async function _cdpBringFront(tabId) {
  try { await _dbgSend(tabId, 'Page.bringToFront'); } catch { /* ignore */ }
}

async function _cdpClick(tabId, x, y) {
  const cx = Math.round(Number(x));
  const cy = Math.round(Number(y));
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    throw new Error('bad coords');
  }
  const fresh = !_dbgAttached.has(tabId);
  await _dbgAttach(tabId);
  // Fresh attach: wait for yellow infobar paint + layout reflow before inject.
  // Content script also re-measures after its own settle.
  if (fresh) await _sleep(400);
  await _cdpBringFront(tabId);
  await _dbgSend(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: cx,
    y: cy,
    button: 'none',
    buttons: 0,
    pointerType: 'mouse',
  });
  await _sleep(40);
  await _dbgSend(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: cx,
    y: cy,
    button: 'left',
    buttons: 1,
    clickCount: 1,
    pointerType: 'mouse',
  });
  await _sleep(55);
  await _dbgSend(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: cx,
    y: cy,
    button: 'left',
    buttons: 0,
    clickCount: 1,
    pointerType: 'mouse',
  });
  return true;
}

function _vkForChar(ch) {
  if (ch === '\n' || ch === '\r') return 13;
  if (ch === '\t') return 9;
  if (ch === ' ') return 32;
  const up = String(ch).toUpperCase();
  if (up.length === 1 && up >= 'A' && up <= 'Z') return up.charCodeAt(0);
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0);
  return ch.charCodeAt(0);
}

function _codeForChar(ch) {
  if (ch === '\n' || ch === '\r') return 'Enter';
  if (ch === '\t') return 'Tab';
  if (ch === ' ') return 'Space';
  if (/^[a-zA-Z]$/.test(ch)) return 'Key' + ch.toUpperCase();
  if (/^[0-9]$/.test(ch)) return 'Digit' + ch;
  return '';
}

/** Trusted key entry for Unity password field.
 *  Unity WebGL Input System needs raw keyDown/char/keyUp.
 *  Do NOT also call insertText first — if the engine accepts it, the
 *  password is typed twice (keys + insertText). Keys alone are reliable. */
async function _cdpType(tabId, text) {
  const s = String(text || '');
  if (!s) return true;
  await _dbgAttach(tabId);
  await _cdpBringFront(tabId);

  // Clear any leftover field content (Ctrl+A, Backspace) before typing
  try {
    await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyDown', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65,
      key: 'a', code: 'KeyA', modifiers: 2,
    });
    await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyUp', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65,
      key: 'a', code: 'KeyA', modifiers: 2,
    });
    await _sleep(20);
    await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyDown', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8,
      key: 'Backspace', code: 'Backspace',
    });
    await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyUp', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8,
      key: 'Backspace', code: 'Backspace',
    });
    await _sleep(30);
  } catch { /* best effort */ }

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const vk = _vkForChar(ch);
    const code = _codeForChar(ch);
    const isPrintable = ch.length === 1 && ch >= ' ' && ch !== '\x7f';
    const base = {
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      key: ch === '\n' || ch === '\r' ? 'Enter' : ch,
      code: code || undefined,
      unmodifiedText: isPrintable ? ch : undefined,
      text: isPrintable ? ch : undefined,
    };
    await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      ...base,
    });
    if (isPrintable) {
      try {
        await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
          type: 'char',
          ...base,
          text: ch,
          unmodifiedText: ch,
        });
      } catch { /* char event optional */ }
    }
    await _dbgSend(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      key: base.key,
      code: code || undefined,
    });
    // Slightly slower so Unity Input System does not drop chars
    await _sleep(i % 3 === 2 ? 28 : 16);
  }
  return true;
}

chrome.debugger.onDetach.addListener((source) => {
  if (source && typeof source.tabId === 'number') _dbgAttached.delete(source.tabId);
});

async function registerAll() {
  try { await resolvePackLayout(); } catch { /* ignore */ }
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [ID_ISO, ID_MAIN, ID_WATCH, ID_STUB],
    });
    if (existing && existing.length) {
      await chrome.scripting.unregisterContentScripts({
        ids: existing.map(s => s.id),
      });
    }
  } catch { /* nothing to clean up */ }
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: ['xb-iso', 'xb-main', 'cs-iso', 'cs-main', 'cs-watch', 'cs-stub'],
    });
  } catch { /* ignore */ }

  // 1.8.11: app.js again at document_start (fetch/WS hooks for chat/mood/ghost).
  // Panel DOM still waits for Play (__xbPlayNow). Stub keeps token sniff.
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: ID_STUB,
        matches: HOST_MATCHES,
        js: STUB_FILES,
        runAt: 'document_start',
        allFrames: true,
        persistAcrossSessions: true,
        world: 'MAIN',
      },
      {
        id: ID_MAIN,
        matches: HOST_MATCHES,
        js: MAIN_FILES,
        runAt: 'document_start',
        allFrames: true,
        persistAcrossSessions: true,
        world: 'MAIN',
      },
      {
        id: ID_ISO,
        matches: HOST_MATCHES,
        js: ISO_FILES,
        runAt: 'document_start',
        allFrames: true,
        persistAcrossSessions: true,
      },
    ]);
  } catch {
    // Already registered or transient error — fail soft.
  }
}

/** Tabs that already received heavy lib+core this load. */
const _coreInjectedTabs = new Set();

async function injectHeavyCore(tabId, reason) {
  if (!tabId) return { ok: false, error: 'no_tab' };
  if (_coreInjectedTabs.has(tabId)) return { ok: true, already: true };
  try { await resolvePackLayout(); } catch { /* ignore */ }
  try {
    // Fallback only — normal path is document_start registration (all frames).
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: MAIN_FILES,
      world: 'MAIN',
    });
    _coreInjectedTabs.add(tabId);
    return { ok: true, reason: reason || 'play' };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

try {
  chrome.tabs.onRemoved.addListener((tabId) => {
    try { _coreInjectedTabs.delete(tabId); } catch { /* ignore */ }
  });
} catch { /* ignore */ }

chrome.runtime.onInstalled.addListener(() => {
  registerAll();
});
chrome.runtime.onStartup.addListener(() => {
  registerAll();
});
registerAll();
setTimeout(() => { try { _warmD3Background('idle'); } catch { /* best-effort */ } }, 1500);

async function injectIntoTab(tab) {
  if (!tab?.id || !/^https:\/\/([a-z0-9-]+\.)?moviestarplanet2\.com\//i.test(tab.url || '')) return;
  try { await resolvePackLayout(); } catch { /* ignore */ }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: STUB_FILES,
      world: 'MAIN',
    });
  } catch { /* best-effort */ }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ISO_FILES,
    });
  } catch { /* best-effort */ }
  try {
    await injectHeavyCore(tab.id, 'action');
  } catch { /* best-effort */ }
}

try {
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info && info.status === 'loading') {
      try { _coreInjectedTabs.delete(tabId); } catch { /* ignore */ }
    }
  });
} catch { /* ignore */ }

chrome.action?.onClicked?.addListener(injectIntoTab);

const _jsonCache = new Map();
let _d3WarmInflight = null;
const _D3_CACHE_NAME = 'xb-d3-v1';
const _D3_CACHE_KEY = 'xb://pack/d3.json';

// D3/emoji loading optimizations from the newer upstream build.
// These only operate on the bundled local extension data and do not add
// network endpoints, telemetry, credential handling, or remote configuration.
function _d3Cached() {
  return _jsonCache.has('d3') || _jsonCache.has('emojis');
}

async function _yieldUi(ms) {
  const delay = Math.max(0, Number(ms) || 0);
  await _sleep(delay);
}

async function _readDurableD3Text() {
  try {
    if (!('caches' in self)) return null;
    const cache = await caches.open(_D3_CACHE_NAME);
    const res = await cache.match(_D3_CACHE_KEY);
    return res && res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function _writeDurableD3Text(text) {
  if (typeof text !== 'string' || !text) return;
  try {
    if (!('caches' in self)) return;
    const cache = await caches.open(_D3_CACHE_NAME);
    await cache.put(
      _D3_CACHE_KEY,
      new Response(text, {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'max-age=31536000',
        },
      }),
    );
  } catch { /* durable cache is best-effort */ }
}

function _notifyPackReady() {
  try {
    chrome.tabs.query(
      { url: ['https://moviestarplanet2.com/*', 'https://*.moviestarplanet2.com/*'] },
      (tabs) => {
        if (chrome.runtime.lastError || !Array.isArray(tabs)) return;
        for (const tab of tabs) {
          if (!tab || typeof tab.id !== 'number') continue;
          try {
            chrome.tabs.sendMessage(tab.id, { type: 'xb:packReady' }, () => {
              void chrome.runtime.lastError;
            });
          } catch { /* ignore */ }
        }
      },
    );
  } catch { /* ignore */ }
}

async function _fetchPackText(logical) {
  const key = String(logical || '').toLowerCase();
  const map = {
    d1: [PACK.d1, `dist/${PACK.d1}`],
    d2: [PACK.d2, `dist/${PACK.d2}`],
    d3: [PACK.d3, `dist/${PACK.d3}`],
  };
  const candidates = map[key] || [logical, `dist/${logical}`];
  for (const path of candidates) {
    try {
      const res = await fetch(chrome.runtime.getURL(path));
      if (res.ok) return await res.text();
    } catch { /* try next candidate */ }
  }
  return null;
}

async function _warmD3Background(reason = 'idle') {
  if (_d3Cached()) return true;
  if (_d3WarmInflight) return _d3WarmInflight;

  const mode = String(reason || 'idle');
  _d3WarmInflight = (async () => {
    try {
      // Give the service worker a chance to finish other work before parsing
      // the large local D3 pack.
      if (mode === 'sync') {
        await _yieldUi(4500);
        await _yieldUi(200);
        await _yieldUi(200);
      } else if (mode === 'prefetch') {
        await _yieldUi(1200);
        await _yieldUi(80);
      } else {
        await _yieldUi(40);
      }

      if (_d3Cached()) {
        try { _notifyPackReady(); } catch { /* ignore */ }
        return true;
      }

      // 1.8.42: use a durable local CacheStorage copy when available.
      // This avoids reparsing the bundled pack after service-worker restarts.
      let text = await _readDurableD3Text();
      if (!text) {
        text = await _fetchPackText('d3');
        if (text) {
          try { await _writeDurableD3Text(text); } catch { /* ignore */ }
        }
      }
      if (!text) return false;

      // Break up the work slightly so the service worker remains responsive.
      await _yieldUi(60);
      await _yieldUi(60);
      await _yieldUi(60);
      await _yieldUi(60);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return false;
      }
      if (!data || typeof data !== 'object') return false;

      _jsonCache.set('d3', data);
      _jsonCache.set('emojis', data);
      try { _notifyPackReady(); } catch { /* ignore */ }
      return true;
    } catch {
      return false;
    } finally {
      if (!_d3Cached()) _d3WarmInflight = null;
    }
  })();

  return _d3WarmInflight;
}

async function _readJSON(logical) {
  // logical: d1 | d2 | d3 | homes | questions | emojis — separate files (SW-safe)
  const map = {
    d1: [PACK.d1, `dist/${PACK.d1}`],
    d2: [PACK.d2, `dist/${PACK.d2}`],
    d3: [PACK.d3, `dist/${PACK.d3}`],
    homes: null,
    questions: null,
    emojis: null,
  };
  map.homes = map.d1;
  map.questions = map.d2;
  map.emojis = map.d3;
  const key = String(logical || '').toLowerCase();
  if (_jsonCache.has(key)) return _jsonCache.get(key);
  if (key === 'd3' || key === 'emojis') {
    await _warmD3Background('pack');
    if (_jsonCache.has('d3')) return _jsonCache.get('d3');
    if (_jsonCache.has('emojis')) return _jsonCache.get('emojis');
  }
  const candidates = map[key] || [logical, `dist/${logical}`];
  for (const path of candidates) {
    try {
      const res = await fetch(chrome.runtime.getURL(path));
      if (res.ok) {
        const data = await res.json();
        if (data !== null && data !== undefined) _jsonCache.set(key, data);
        return data;
      }
    } catch { /* try next */ }
  }
  return null;
}

/** Catalog light stubs — full binary on demand. */
function _homesLight(homes) {
  if (!Array.isArray(homes)) return [];
  return homes
    .filter((h) => h && typeof h.name === 'string' && h.name)
    .map((h) => ({
      name: h.name,
      bundled: true,
      hasBson: !!(h.bson_data && String(h.bson_data).length),
      hasImg: !!(h.img && String(h.img).length),
      img: typeof h.img === 'string' && h.img ? h.img : '',
    }));
}

async function _homeFullByName(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const homes = await _readJSON('d1');
  if (!Array.isArray(homes)) return null;
  const hit = homes.find((h) => h && h.name === key);
  if (!hit) return null;
  return {
    name: hit.name,
    img: typeof hit.img === 'string' ? hit.img : '',
    bson_data: typeof hit.bson_data === 'string' ? hit.bson_data : '',
    bundled: true,
  };
}

// Runtime message handlers (internal type strings; not filenames)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  if (msg.type === 'xb:boot') {
    (async () => {
      try {
        const [homes, questions] = await Promise.all([
          _readJSON('d1'),
          _readJSON('d2'),
        ]);
        sendResponse({
          ok: true,
          homes: _homesLight(homes),
          questions: (questions && typeof questions === 'object') ? questions : {},
          emojis: null,
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: String(err && err.message ? err.message : err),
        });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:home') {
    (async () => {
      try {
        const home = await _homeFullByName(msg.name);
        if (!home || !home.bson_data) {
          sendResponse({ ok: false, error: 'home-not-found' });
          return;
        }
        sendResponse({ ok: true, home });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:pack') {
    (async () => {
      try {
        _d3Cached() || await _warmD3Background('pack');
        const emojis = _d3Cached()
          ? (_jsonCache.get('d3') || _jsonCache.get('emojis'))
          : await _readJSON('d3');
        if (!emojis || typeof emojis !== 'object') {
          sendResponse({ ok: false, error: 'emojis-not-found' });
          return;
        }
        sendResponse({ ok: true, emojis });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:prefetch') {
    (async () => {
      try {
        const packs = Array.isArray(msg.packs) ? msg.packs : ['d1', 'd2'];
        for (const pack of packs) {
          const key = String(pack || '').toLowerCase();
          if (key === 'd1' || key === 'homes') await _readJSON('d1');
          else if (key === 'd2' || key === 'questions') await _readJSON('d2');
          else if (key === 'd3' || key === 'emojis') await _warmD3Background('prefetch');
          await _yieldUi(80);
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:input') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'no-tab' });
      return false;
    }
    (async () => {
      try {
        const op = String(msg.op || '');
        if (op === 'attach') {
          await _dbgAttach(tabId);
          sendResponse({ ok: true, via: 'cdp' });
          return;
        }
        if (op === 'detach') {
          await _dbgDetach(tabId);
          sendResponse({ ok: true, via: 'cdp' });
          return;
        }
        if (op === 'click') {
          await _cdpClick(tabId, msg.x, msg.y);
          sendResponse({ ok: true, via: 'cdp' });
          return;
        }
        if (op === 'type') {
          await _cdpType(tabId, msg.text);
          sendResponse({ ok: true, via: 'cdp' });
          return;
        }
        sendResponse({ ok: false, error: 'bad-op' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:session') {
    (async () => {
      try {
        const accessToken = String(msg.accessToken || msg.at || '').trim();
        const refreshToken = String(msg.refreshToken || msg.rt || '').trim();
        if (!accessToken || accessToken.length < 20) {
          sendResponse({ ok: false });
          return;
        }
        await chrome.storage.session.set({
          xbSession: { at: accessToken, rt: refreshToken, ts: Date.now() },
        });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:injectMain') {
    const tabId = sender && sender.tab && sender.tab.id;
    (async () => {
      try {
        const r = await injectHeavyCore(tabId, msg && msg.why);
        sendResponse(r);
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:feedback') {
    sendResponse({ ok: false, error: 'Feedback ist in der Datenschutz-Version deaktiviert' });
    return false;
  }

  if (msg.type !== 'xb:boot') return false;
  (async () => {
    try {
      // Do NOT await remote config here — blocks Unity load path.
          const [homes, questions] = await Promise.all([
        _readJSON('d1'),
        _readJSON('d2'),
      ]);
      sendResponse({
        ok: true,
        // Light catalog only — full bson/img loaded via xb:home on apply/preview
        homes: _homesLight(homes),
        questions: (questions && typeof questions === 'object') ? questions : {},
        // Full emoji pack: xb:pack (ayri kanal)
        emojis: null,
        gate: _cachedGate,
      });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message ?? err) });
    }
  })();
  return true; // async response
});
