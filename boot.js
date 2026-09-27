(() => {
  try {
    if (window.__xbBridge) return;
    Object.defineProperty(window, "__xbBridge", {
      value: true, configurable: false, enumerable: false, writable: false
    });

    const rnd = crypto.getRandomValues(new Uint8Array(16));
    const KEY = Array.from(rnd, b => b.toString(16).padStart(2, "0")).join("");
    const ORIGIN = window.location.origin;
    let lastBootPayload = null;
    let catalogRequested = false;
    let catalogReady = false;
    let coreRequested = false;
    let packDelivered = false;
    let packDeliverArmed = false;
    let idleWarmArmed = false;

    const postBootstrap = payload => {
      try { if (payload && typeof payload === "object") lastBootPayload = payload; } catch {}
      const envelope = {};
      envelope[KEY] = payload;
      let tries = 0;
      const fire = () => {
        try { window.postMessage(envelope, ORIGIN); } catch {}
        if (++tries < 6) setTimeout(fire, 50);
      };
      fire();
    };

    const idleRun = (fn, timeoutMs = 2500) => {
      const run = () => { try { fn(); } catch {} };
      try {
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(run, { timeout: Math.max(1000, timeoutMs | 0) });
          return;
        }
      } catch {}
      setTimeout(run, Math.min(2500, Math.max(400, timeoutMs | 0)));
    };

    const requestPack = () => {
      const reqId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      try { window.postMessage({ __xbPack: 1, dir: "req", reqId }, ORIGIN); } catch {}
      chrome.runtime.sendMessage({ type: "xb:pack" }, reply => {
        void chrome.runtime.lastError;
        try {
          if (reply?.ok && reply.emojis) packDelivered = true;
          window.postMessage({
            __xbPack: 1, dir: "res", reqId,
            ok: !!(reply?.ok && reply?.emojis),
            emojis: reply?.emojis || null,
            error: reply?.error || chrome.runtime.lastError?.message || null
          }, ORIGIN);
        } catch {}
      });
    };

    function scheduleIdlePackDeliver() {
      if (packDelivered || packDeliverArmed) return;
      packDeliverArmed = true;
      setTimeout(() => idleRun(requestPack, 3500), 1200);
    }

    function deliverHomesToCore() {
      if (!lastBootPayload) return;
      try {
        const envelope = {};
        envelope[KEY] = lastBootPayload;
        window.postMessage(envelope, ORIGIN);
      } catch {}
    }

    function requestCatalog(why) {
      if (catalogReady) { deliverHomesToCore(); return; }
      if (catalogRequested) return;
      catalogRequested = true;
      try {
        window.postMessage({
          __xbCatalog: 1, dir: "res", ok: false, pending: true, why: String(why || "")
        }, ORIGIN);
      } catch {}
      chrome.runtime.sendMessage({ type: "xb:catalog" }, reply => {
        void chrome.runtime.lastError;
        if (!reply?.ok) {
          catalogRequested = false;
          try {
            window.postMessage({
              __xbCatalog: 1, dir: "res", ok: false, pending: false,
              error: reply?.error || chrome.runtime.lastError?.message || "catalog-failed"
            }, ORIGIN);
          } catch {}
          return;
        }
        catalogReady = true;
        postBootstrap({
          nonce: KEY,
          homes: Array.isArray(reply.homes) ? reply.homes : [],
          questions: reply.questions && typeof reply.questions === "object" ? reply.questions : {},
          emojis: null
        });
        deliverHomesToCore();
        try { window.postMessage({ __xbCatalog: 1, dir: "res", ok: true, pending: false }, ORIGIN); } catch {}
      });
    }

    function scheduleIdleWarm() {
      if (idleWarmArmed) return;
      idleWarmArmed = true;
      setTimeout(() => idleRun(() => requestCatalog("idle"), 7000), 2800);
      setTimeout(() => idleRun(() => {
        try { chrome.runtime.sendMessage({ type: "xb:prefetch", packs: ["d1", "d2"] }); } catch {}
      }, 12000), 9000);
    }

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      try {
        if (!msg || typeof msg !== "object") return false;
        if (msg.type === "xb:packReady") {
          scheduleIdlePackDeliver();
          sendResponse({ ok: true });
          return false;
        }
      } catch {}
      return false;
    });

    window.addEventListener("message", ev => {
      try {
        if (ev.source !== window) return;
        const d = ev.data;
        if (!d || typeof d !== "object") return;

        if (d.__xbInput === 1 && d.dir === "req" && typeof d.reqId === "string") {
          chrome.runtime.sendMessage({
            type: "xb:input", op: d.op, x: d.x, y: d.y
          }, reply => {
            void chrome.runtime.lastError;
            try {
              window.postMessage({
                __xbInput: 1, dir: "res", reqId: d.reqId,
                ok: !!reply?.ok, error: reply?.error || chrome.runtime.lastError?.message || null,
                via: reply?.via || null
              }, ORIGIN);
            } catch {}
          });
          return;
        }

        if (d.__xbHome === 1 && d.dir === "req" && typeof d.reqId === "string") {
          chrome.runtime.sendMessage({ type: "xb:home", name: d.name }, reply => {
            void chrome.runtime.lastError;
            try {
              window.postMessage({
                __xbHome: 1, dir: "res", reqId: d.reqId,
                ok: !!(reply?.ok && reply?.home),
                home: reply?.home || null,
                error: reply?.error || chrome.runtime.lastError?.message || null
              }, ORIGIN);
            } catch {}
          });
          return;
        }

        if (d.__xbPack === 1 && d.dir === "req" && typeof d.reqId === "string") {
          chrome.runtime.sendMessage({ type: "xb:pack" }, reply => {
            void chrome.runtime.lastError;
            try {
              window.postMessage({
                __xbPack: 1, dir: "res", reqId: d.reqId,
                ok: !!(reply?.ok && reply?.emojis),
                emojis: reply?.emojis || null,
                error: reply?.error || chrome.runtime.lastError?.message || null
              }, ORIGIN);
            } catch {}
          });
          return;
        }

        // Explicitly ignored: credentials, session tokens, feedback and vendor sync.
        if (d.__xbCred || d.__xbAuth || d.__xbFeedback || d.__xbSync) return;

        if (d.__xbNeedCore === 1) {
          requestHeavyCore(d.why || "auth");
          return;
        }
        if (d.__xbNeedCatalog === 1) {
          requestCatalog(d.why || "panel");
          return;
        }
        if (d.__xbNeedBoot === 1) {
          if (catalogReady && lastBootPayload) deliverHomesToCore();
          else requestCatalog("need-boot");
        }
      } catch {}
    });

    function requestHeavyCore(why) {
      if (coreRequested) return;
      coreRequested = true;
      const ts = Date.now();
      try { sessionStorage.setItem("__xb_play", String(ts)); } catch {}
      try { window.postMessage({ __xbPlayNow: 1, why: String(why || "play"), t: ts }, ORIGIN); } catch {}
      setTimeout(() => {
        try {
          chrome.runtime.sendMessage({ type: "xb:injectMain", why: String(why || "play") }, reply => {
            void chrome.runtime.lastError;
            try { window.postMessage({ __xbPlayNow: 1, why: String(why || "play"), t: Date.now() }, ORIGIN); } catch {}
            if (!reply || reply.ok !== false) {
              setTimeout(deliverHomesToCore, 250);
              setTimeout(deliverHomesToCore, 900);
              scheduleIdleWarm();
            }
          });
        } catch {
          coreRequested = false;
        }
      }, 120);
      setTimeout(deliverHomesToCore, 200);
      setTimeout(deliverHomesToCore, 700);
      scheduleIdleWarm();
    }

    function bodyText() {
      try { return String((document.body && document.body.innerText) || "").slice(0, 12000).toLowerCase(); }
      catch { return ""; }
    }

    function isPlayEl(el) {
      try {
        for (let i = 0; el && i < 10; i++) {
          const tag = String(el.tagName || "").toLowerCase();
          const id = String(el.id || "").toLowerCase();
          const cls = String(el.className || "").toLowerCase();
          const aria = String(el.getAttribute?.("aria-label") || el.getAttribute?.("title") || "").toLowerCase();
          const tx = String(el.innerText || el.textContent || el.value || "").replace(/\s+/g, " ").trim().toLowerCase();
          if (id.includes("play") || cls.includes("play") || aria.includes("play") || aria.includes("oyna")) return true;
          if (/^play$|^şimdi oyna$|^simdi oyna$|^oyna$|^play now$/.test(tx)) return true;
          if (tx.length < 28 && /(şimdi oyna|simdi oyna|play now|^play$)/.test(tx) &&
              ["button","a","div","span"].includes(tag)) return true;
          el = el.parentElement;
        }
      } catch {}
      return false;
    }

    function onUserGesture(ev, why) {
      try { if (!coreRequested && (isPlayEl(ev?.target) || bodyText().includes("play now"))) requestHeavyCore(why || "gesture"); }
      catch {}
    }

    function armPlayGate() {
      try {
        if (window !== window.top) return;
        for (const ev of ["pointerdown","mousedown","click","touchstart"]) {
          document.addEventListener(ev, e => onUserGesture(e, ev), true);
        }
      } catch {}
      let n = 0;
      const watch = () => {
        if (coreRequested) return;
        try {
          if (/%/.test(bodyText()) || /loading|yükleniyor|yukleniyor/.test(bodyText())) requestHeavyCore("loading");
          else if (++n < 120) setTimeout(watch, 250);
        } catch { if (++n < 120) setTimeout(watch, 400); }
      };
      setTimeout(watch, 400);
    }

    chrome.runtime.sendMessage({ type: "xb:boot" }, reply => {
      void chrome.runtime.lastError;
      if (!reply?.ok) return;
      postBootstrap({
        nonce: KEY,
        homes: Array.isArray(reply.homes) ? reply.homes : [],
        questions: reply.questions && typeof reply.questions === "object" ? reply.questions : {},
        emojis: null
      });
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", armPlayGate, { once: true });
    else armPlayGate();
  } catch {}
})();
