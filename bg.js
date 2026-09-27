// 6x0k Space — clean service worker
// Local-only extension plumbing: script injection, data packs, safe UI automation and clipboard.
// No credential capture, password storage, token vault, vendor telemetry, remote gate or feedback service.

const HOST_MATCHES = [
  'https://moviestarplanet2.com/*',
  'https://*.moviestarplanet2.com/*',
];

const PACK = {
  app: 'app.js',
  boot: 'boot.js',
  seed: 'seed.js',
  d1: 'd1.json',
  d2: 'd2.json',
  d3: 'd3.json',
};

const ID_ISO = 'cs-iso';
const ID_MAIN = 'cs-main';
const ID_SEED = 'cs-s0';

let MAIN_FILES = [PACK.app];
let ISO_FILES = [PACK.boot];
let SEED_FILES = [PACK.seed];
let _layoutReady = null;

async function resolvePackLayout() {
  if (_layoutReady) return _layoutReady;
  _layoutReady = (async () => {
    try {
      const r = await fetch(chrome.runtime.getURL(PACK.app));
      if (r.ok) {
        MAIN_FILES = [PACK.app];
        ISO_FILES = [PACK.boot];
        SEED_FILES = [PACK.seed];
        return 'flat';
      }
    } catch {}
    MAIN_FILES = [`dist/${PACK.app}`];
    ISO_FILES = [`dist/${PACK.boot}`];
    SEED_FILES = [`dist/${PACK.seed}`];
    return 'dist';
  })();
  return _layoutReady;
}

async function registerAll() {
  try { await resolvePackLayout(); } catch {}
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [ID_ISO, ID_MAIN, ID_SEED],
    });
  } catch {}

  try {
    await chrome.scripting.registerContentScripts([{
      id: ID_SEED,
      matches: HOST_MATCHES,
      js: SEED_FILES,
      runAt: 'document_start',
      allFrames: true,
      persistAcrossSessions: true,
      world: 'MAIN',
    }]);
  } catch {}

  try {
    await chrome.scripting.registerContentScripts([{
      id: ID_ISO,
      matches: HOST_MATCHES,
      js: ISO_FILES,
      runAt: 'document_start',
      allFrames: true,
      persistAcrossSessions: true,
    }]);
  } catch {}

  try {
    await chrome.scripting.registerContentScripts([{
      id: ID_MAIN,
      matches: HOST_MATCHES,
      js: MAIN_FILES,
      runAt: 'document_start',
      allFrames: true,
      persistAcrossSessions: true,
      world: 'MAIN',
    }]);
  } catch {}
}

const _dbgAttached = new Set();

async function _dbgAttach(tabId) {
  if (_dbgAttached.has(tabId)) return true;
  await chrome.debugger.attach({ tabId }, '1.3');
  _dbgAttached.add(tabId);
  return true;
}

async function _dbgDetach(tabId) {
  try { await chrome.debugger.detach({ tabId }); } catch {}
  _dbgAttached.delete(tabId);
  return true;
}

async function _dbgSend(tabId, method, params) {
  return chrome.debugger.sendCommand({ tabId }, method, params || {});
}

async function _cdpBringFront(tabId) {
  try { await _dbgSend(tabId, 'Page.bringToFront'); } catch {}
}

async function _cdpClick(tabId, x, y) {
  const cx = Math.round(Number(x));
  const cy = Math.round(Number(y));
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) throw new Error('bad coords');
  const fresh = !_dbgAttached.has(tabId);
  await _dbgAttach(tabId);
  if (fresh) await new Promise(r => setTimeout(r, 350));
  await _cdpBringFront(tabId);
  await _dbgSend(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: cx, y: cy, button: 'none', buttons: 0, pointerType: 'mouse',
  });
  await _dbgSend(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse',
  });
  await new Promise(r => setTimeout(r, 45));
  await _dbgSend(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: cx, y: cy, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse',
  });
  return true;
}

chrome.debugger.onDetach.addListener(source => {
  if (source && typeof source.tabId === 'number') _dbgAttached.delete(source.tabId);
});

const _coreInjectedTabs = new Set();

async function injectHeavyCore(tabId, reason) {
  if (!tabId) return { ok: false, error: 'no_tab' };
  if (_coreInjectedTabs.has(tabId)) return { ok: true, already: true };
  try { await resolvePackLayout(); } catch {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: MAIN_FILES,
      world: 'MAIN',
    });
    _coreInjectedTabs.add(tabId);
    return { ok: true, reason: reason || 'play' };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

async function injectIntoTab(tab) {
  if (!tab?.id || !/^https:\/\/([a-z0-9-]+\.)?moviestarplanet2\.com\//i.test(tab.url || '')) return;
  try { await resolvePackLayout(); } catch {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: SEED_FILES,
      world: 'MAIN',
    });
  } catch {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ISO_FILES,
    });
  } catch {}
  try { await injectHeavyCore(tab.id, 'action'); } catch {}
}

try {
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info?.status === 'loading') _coreInjectedTabs.delete(tabId);
  });
  chrome.tabs.onRemoved.addListener(tabId => {
    _coreInjectedTabs.delete(tabId);
    _dbgAttached.delete(tabId);
  });
} catch {}

chrome.action?.onClicked?.addListener(injectIntoTab);

chrome.runtime.onInstalled.addListener(() => { registerAll(); });
chrome.runtime.onStartup.addListener(() => { registerAll(); });
registerAll();

const _jsonCache = new Map();

async function _fetchPackText(name) {
  const key = String(name || '').toLowerCase();
  if (!['d1', 'd2', 'd3'].includes(key)) throw new Error('unknown-pack');
  const url = chrome.runtime.getURL(PACK[key]);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`pack-${key}-${r.status}`);
  return r.text();
}

async function _readJSON(name) {
  const key = String(name || '').toLowerCase();
  if (_jsonCache.has(key)) return _jsonCache.get(key);
  const text = await _fetchPackText(key);
  const data = JSON.parse(text);
  _jsonCache.set(key, data);
  return data;
}

async function _yieldUi(ms = 60) {
  return new Promise(r => setTimeout(r, ms));
}

async function _warmD3Background() {
  if (_jsonCache.has('d3')) return true;
  await _readJSON('d3');
  return true;
}

function _d3Cached() {
  return _jsonCache.has('d3');
}

function _homesLight(homes) {
  if (!Array.isArray(homes)) return [];
  return homes.map(h => ({
    name: h?.name,
    bundled: true,
    hasBson: !!(h?.bson_data && String(h.bson_data).length),
    hasImg: !!(h?.img && String(h.img).length),
    img: '',
  }));
}

async function _homeFullByName(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const homes = await _readJSON('d1');
  if (!Array.isArray(homes)) return null;
  const hit = homes.find(h => h && h.name === key);
  if (!hit) return null;
  return {
    name: hit.name,
    img: typeof hit.img === 'string' ? hit.img : '',
    bson_data: typeof hit.bson_data === 'string' ? hit.bson_data : '',
    bundled: true,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  if (msg.type === 'xbAgSchedule') {
    try {
      const when = Number(msg.when);
      chrome.alarms.create('xbAgWake', {
        when: Number.isFinite(when) && when > Date.now() + 300 ? when : Date.now() + 800,
      });
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
    return false;
  }

  if (msg.type === 'xbAgClear') {
    try { chrome.alarms.clear('xbAgWake'); } catch {}
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'xb:home') {
    (async () => {
      try {
        const home = await _homeFullByName(msg.name);
        sendResponse(home?.bson_data
          ? { ok: true, home }
          : { ok: false, error: 'home-not-found' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:pack') {
    (async () => {
      try {
        if (!_d3Cached()) await _warmD3Background();
        const emojis = _jsonCache.get('d3') || await _readJSON('d3');
        sendResponse(emojis && typeof emojis === 'object'
          ? { ok: true, emojis }
          : { ok: false, error: 'emojis-not-found' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:prefetch') {
    (async () => {
      try {
        const packs = Array.isArray(msg.packs) ? msg.packs : ['d1', 'd2'];
        for (const p of packs) {
          const key = String(p || '').toLowerCase();
          if (key === 'd1' || key === 'homes') await _readJSON('d1');
          else if (key === 'd2' || key === 'questions') await _readJSON('d2');
          else if (key === 'd3' || key === 'emojis') await _warmD3Background();
          await _yieldUi(60);
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:catalog') {
    (async () => {
      try {
        const [homes, questions] = await Promise.all([_readJSON('d1'), _readJSON('d2')]);
        sendResponse({
          ok: true,
          homes: _homesLight(homes),
          questions: questions && typeof questions === 'object' ? questions : {},
        });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:input') {
    const tabId = sender?.tab?.id;
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
        } else if (op === 'detach') {
          await _dbgDetach(tabId);
          sendResponse({ ok: true, via: 'cdp' });
        } else if (op === 'click') {
          await _cdpClick(tabId, msg.x, msg.y);
          sendResponse({ ok: true, via: 'cdp' });
        } else {
          sendResponse({ ok: false, error: 'unsupported-op' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:injectMain') {
    (async () => {
      try { sendResponse(await injectHeavyCore(sender?.tab?.id, msg?.why)); }
      catch (err) { sendResponse({ ok: false, error: String(err?.message || err) }); }
    })();
    return true;
  }

  if (msg.type === 'xb-clipboard-write') {
    const text = String(msg.text || '');
    if (!text) { sendResponse({ ok: false }); return false; }
    (async () => {
      try {
        await navigator.clipboard.writeText(text);
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (msg.type === 'xb:boot') {
    sendResponse({ ok: true, homes: [], questions: {}, emojis: null, deferred: true });
    return false;
  }

  // Deliberately no credential/session/feedback/telemetry handlers.
  return false;
});

try {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (!alarm || alarm.name !== 'xbAgWake') return;
    chrome.tabs.query({
      url: ['*://*.moviestarplanet2.com/*', '*://moviestarplanet2.com/*'],
    }, tabs => {
      for (const tab of tabs || []) {
        if (!tab?.id) continue;
        try { chrome.tabs.sendMessage(tab.id, { type: 'xbAgWake' }, () => void chrome.runtime.lastError); }
        catch {}
      }
    });
  });
} catch {}
