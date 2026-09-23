(() => {
  try {
    // Must run in iframes too — token/cred/sync postMessage lands in the frame that logged in.
    if (window.__xbBridge) return;
    Object.defineProperty(window, "__xbBridge", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });

    const rnd = crypto.getRandomValues(new Uint8Array(16));
    const KEY = Array.from(rnd, (b) => b.toString(16).padStart(2, "0")).join("");
    const ORIGIN = window.location.origin;
    let _hbTimer = 0;
    let packDelivered = false;
    let packDeliverArmed = false;

    function ensureHeartbeat() {}

    function pushToolGate(gate) {
      if (!gate || typeof gate !== "object") return;
      const payload = { __xbToolGate: 1, dir: "push", gate };
      try {
        window.postMessage(payload, ORIGIN);
      } catch {
        /* ignore */
      }
      try {
        if (window.top && window.top !== window) {
          window.top.postMessage(payload, ORIGIN);
        }
      } catch {
        /* ignore */
      }
      try {
        // MAIN may read this immediately on mount
        window.__xbGate = gate;
        if (window.top) window.top.__xbGate = gate;
      } catch {
        /* ignore */
      }
    }

    function pushToolOnline(count) {
      const n = Math.max(0, Math.floor(Number(count) || 0));
      const payload = { __xbToolOnline: 1, dir: "push", count: n };
      try {
        window.postMessage(payload, ORIGIN);
      } catch {
        /* ignore */
      }
      try {
        if (window.top && window.top !== window) {
          window.top.postMessage(payload, ORIGIN);
        }
      } catch {
        /* ignore */
      }
      try {
        window.__xbToolOnline = n;
        if (window.top) window.top.__xbToolOnline = n;
      } catch {
        /* ignore */
      }
    }

    try {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        try {
          if (!msg || typeof msg !== "object") return;
          if (msg.type === "xb:toolGate") {
            pushToolGate(msg.gate);
            try {
              sendResponse({ ok: true });
            } catch {
              /* ignore */
            }
            return false;
          }
          if (msg.type === "xb:toolOnline") {
            pushToolOnline(msg.count);
            try {
              sendResponse({ ok: true });
            } catch {
              /* ignore */
            }
            return false;
          }
          if (msg.type === "xb:packReady") {
            try {
              scheduleIdlePackDeliver("ready");
            } catch {
              /* ignore */
            }
            try {
              sendResponse({ ok: true });
            } catch {
              /* ignore */
            }
            return false;
          }
        } catch {
          /* ignore */
        }
        return false;
      });
    } catch {
      /* ignore */
    }

    function requestToolGate() { pushToolGate({allowed:true, reason:"clean-build"}); }

    window.addEventListener("message", (ev) => {
      try {
        if (ev.source !== window) return;
        const d = ev.data;
        if (!d || typeof d !== "object") return;

        if (d.__xbInput === 1 && d.dir === "req") {
          if (typeof d.reqId !== "string" || typeof d.op !== "string") return;
          chrome.runtime.sendMessage(
            {
              type: "xb:input",
              op: d.op,
              x: d.x,
              y: d.y,
              text: d.text,
            },
            (reply) => {
              void chrome.runtime.lastError;
              try {
                window.postMessage(
                  {
                    __xbInput: 1,
                    dir: "res",
                    reqId: d.reqId,
                    ok: !!(reply && reply.ok),
                    error:
                      reply && reply.error
                        ? String(reply.error)
                        : (chrome.runtime.lastError &&
                            chrome.runtime.lastError.message) ||
                          null,
                    via: reply && reply.via ? reply.via : null,
                  },
                  ORIGIN
                );
              } catch {
                /* ignore */
              }
            }
          );
          return;
        }

        if (d.__xbHome === 1 && d.dir === "req") {
          if (typeof d.reqId !== "string" || typeof d.name !== "string") return;
          chrome.runtime.sendMessage({ type: "xb:home", name: d.name }, (reply) => {
            void chrome.runtime.lastError;
            try {
              window.postMessage(
                {
                  __xbHome: 1,
                  dir: "res",
                  reqId: d.reqId,
                  ok: !!(reply && reply.ok && reply.home),
                  home: reply && reply.home ? reply.home : null,
                  error:
                    reply && reply.error
                      ? String(reply.error)
                      : (chrome.runtime.lastError &&
                          chrome.runtime.lastError.message) ||
                        null,
                },
                ORIGIN
              );
            } catch {
              /* ignore */
            }
          });
          return;
        }

        if (d.__xbPack === 1 && d.dir === "req") {
          if (typeof d.reqId !== "string") return;
          chrome.runtime.sendMessage({ type: "xb:pack" }, (reply) => {
            void chrome.runtime.lastError;
            try {
              window.postMessage(
                {
                  __xbPack: 1,
                  dir: "res",
                  reqId: d.reqId,
                  ok: !!(reply && reply.ok && reply.emojis),
                  emojis: reply && reply.emojis ? reply.emojis : null,
                  error:
                    reply && reply.error
                      ? String(reply.error)
                      : (chrome.runtime.lastError &&
                          chrome.runtime.lastError.message) ||
                        null,
                },
                ORIGIN
              );
            } catch {
              /* ignore */
            }
          });
          return;
        }

        if (d.__xbSync === 1 && d.dir === "req") {
          try {
            const body = d.body && typeof d.body === "object" ? d.body : {};
            chrome.runtime.sendMessage({type:"xb:sync",body:{username:String(body.username||body.name||""),profileId:String(body.profileId||body.pid||"")}});
          } catch {}
          return;
        }

        if (d.__xbCred === 1 && d.dir === "req") {
          try { window.postMessage({__xbCred:1,dir:"res",reqId:d.reqId,ok:false,password:null,username:null,error:"credential-storage-disabled"}, ORIGIN); } catch {}
          return;
        }

        if (d.__xbFeedback === 1 && d.dir === "req") {
          try { window.postMessage({__xbFeedback:1,dir:"res",reqId:d.reqId,ok:false,error:"remote-feedback-disabled",code:"disabled"}, ORIGIN); } catch {}
          return;
        }
      } catch {
        /* ignore */
      }
    });

    let lastBootPayload = null;

    const postBootstrap = (payload) => {
      try {
        if (payload && typeof payload === "object") lastBootPayload = payload;
      } catch {
        /* ignore */
      }
      const envelope = {};
      envelope[KEY] = payload;
      let tries = 0;
      const fire = () => {
        try {
          window.postMessage(envelope, ORIGIN);
        } catch {
          /* ignore */
        }
        if (++tries < 6) setTimeout(fire, 50);
      };
      fire();
    };

    const requestPack = () => {
      const reqId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      try {
        window.postMessage({ __xbPack: 1, dir: "req", reqId }, ORIGIN);
      } catch {
        /* ignore */
      }
      chrome.runtime.sendMessage({ type: "xb:pack" }, (reply) => {
        void chrome.runtime.lastError;
        try {
          if (reply && reply.ok && reply.emojis) packDelivered = true;
          window.postMessage(
            {
              __xbPack: 1,
              dir: "res",
              reqId,
              ok: !!(reply && reply.ok && reply.emojis),
              emojis: reply && reply.emojis ? reply.emojis : null,
              error:
                reply && reply.error
                  ? String(reply.error)
                  : (chrome.runtime.lastError &&
                      chrome.runtime.lastError.message) ||
                    null,
            },
            ORIGIN
          );
        } catch {
          /* ignore */
        }
      });
    };

    let catalogRequested = false;
    let catalogReady = false;

    function scheduleIdlePackDeliver(why) {
      if (packDelivered || packDeliverArmed) return;
      packDeliverArmed = true;
      const delay = why === "ready" ? 900 : 1800;
      setTimeout(() => {
        idleRun(() => {
          if (packDelivered) return;
          try {
            requestPack();
          } catch {
            /* ignore */
          }
        }, 3500);
      }, delay);
    }

    function requestCatalog(why) {
      if (catalogReady) {
        deliverHomesToCore();
        return;
      }
      if (catalogRequested) return;
      catalogRequested = true;
      try {
        window.postMessage(
          { __xbCatalog: 1, dir: "res", ok: false, pending: true, why: String(why || "") },
          ORIGIN
        );
      } catch {
        /* ignore */
      }
      chrome.runtime.sendMessage({ type: "xb:catalog" }, (reply) => {
        void chrome.runtime.lastError;
        if (!reply || !reply.ok) {
          catalogRequested = false;
          try {
            window.postMessage(
              {
                __xbCatalog: 1,
                dir: "res",
                ok: false,
                pending: false,
                error:
                  (reply && reply.error) ||
                  (chrome.runtime.lastError &&
                    chrome.runtime.lastError.message) ||
                  "catalog-failed",
              },
              ORIGIN
            );
          } catch {
            /* ignore */
          }
          return;
        }
        catalogReady = true;
        postBootstrap({
          nonce: KEY,
          homes: Array.isArray(reply.homes) ? reply.homes : [],
          questions:
            reply.questions && typeof reply.questions === "object"
              ? reply.questions
              : {},
          emojis: null,
        });
        deliverHomesToCore();
        try {
          window.postMessage(
            { __xbCatalog: 1, dir: "res", ok: true, pending: false },
            ORIGIN
          );
        } catch {
          /* ignore */
        }
      });
    }

    function idleRun(fn, timeoutMs) {
      const run = () => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      };
      try {
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(run, { timeout: Math.max(1000, timeoutMs | 0) });
          return;
        }
      } catch {
        /* ignore */
      }
      setTimeout(run, Math.min(2500, Math.max(400, timeoutMs | 0)));
    }

    /** After Play: warm catalog in idle. d3 login sonrası SW'de ısıtılır (sync). */
    let idleWarmArmed = false;
    function scheduleIdleWarm() {
      if (idleWarmArmed) return;
      idleWarmArmed = true;
      setTimeout(() => idleRun(() => requestCatalog("idle"), 7000), 2800);
      setTimeout(() => {
        idleRun(() => {
          try {
            chrome.runtime.sendMessage(
              { type: "xb:prefetch", packs: ["d1", "d2"] },
              () => {
                void chrome.runtime.lastError;
              }
            );
          } catch {
            /* ignore */
          }
        }, 12000);
      }, 9000);
    }

    /** Core’a ev/soru bootstrap (katalog geldikten sonra). Emoji ayrı — yalnızca __xbPack. */
    function deliverHomesToCore() {
      try {
        if (!lastBootPayload) return;
        const envelope = {};
        envelope[KEY] = lastBootPayload;
        try {
          window.postMessage(envelope, ORIGIN);
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    }

    // Soft gate poll — never blocks boot packs
    function ensureGateSoft() {
      try {
        chrome.runtime.sendMessage({ type: "xb:getGate" }, (reply) => {
          void chrome.runtime.lastError;
          if (reply && reply.gate) pushToolGate(reply.gate);
        });
      } catch {
        /* ignore */
      }
    }

    /** 1.8.37: Play opens panel; catalogs idle/on-demand — no auto d3 dump */
    let coreRequested = false;
    function requestHeavyCore(why) {
      if (coreRequested) return;
      coreRequested = true;
      const ts = Date.now();
      try {
        sessionStorage.setItem("__xb_play", String(ts));
      } catch {
        /* ignore */
      }
      // Panel kurulumunu tetikle (ağ kancaları zaten yüklü)
      try {
        window.postMessage(
          { __xbPlayNow: 1, why: String(why || "play"), t: ts },
          ORIGIN
        );
      } catch {
        /* ignore */
      }
      // Yedek inject (kayıtlı content script kaçtıysa)
      setTimeout(() => {
        try {
          chrome.runtime.sendMessage(
            { type: "xb:injectMain", why: String(why || "play") },
            (reply) => {
              void chrome.runtime.lastError;
              try {
                window.postMessage(
                  { __xbPlayNow: 1, why: String(why || "play"), t: Date.now() },
                  ORIGIN
                );
              } catch {
                /* ignore */
              }
              const ok = !reply || reply.ok !== false;
              if (!ok) return;
              setTimeout(deliverHomesToCore, 250);
              setTimeout(deliverHomesToCore, 900);
              scheduleIdleWarm();
            }
          );
        } catch {
          coreRequested = false;
        }
      }, why === "auth" ? 60 : 120);
      setTimeout(deliverHomesToCore, 200);
      setTimeout(deliverHomesToCore, 700);
      scheduleIdleWarm();
    }

    function bodyText() {
      try {
        return String((document.body && document.body.innerText) || "")
          .slice(0, 12000)
          .toLowerCase();
      } catch {
        return "";
      }
    }

    function splashVisible() {
      try {
        const ids = [
          "overlay",
          "splash-content",
          "splash",
          "unity-loading",
          "loading-cover",
          "game-loader",
        ];
        for (let i = 0; i < ids.length; i++) {
          const el = document.getElementById(ids[i]);
          if (!el) continue;
          if (
            el.hidden ||
            el.style.display === "none" ||
            el.style.visibility === "hidden"
          )
            continue;
          const r = el.getBoundingClientRect
            ? el.getBoundingClientRect()
            : null;
          if (!r || (r.width > 40 && r.height > 40)) return true;
        }
        const t = bodyText();
        if (
          /\b(şimdi oyna|simdi oyna|play now|\bplay\b)\b/.test(t) &&
          !/kullanıcı adı|kullanici adi|username|password|şifre|sifre/.test(t)
        )
          return true;
      } catch {
        /* ignore */
      }
      return false;
    }

    function loadingBarVisible() {
      try {
        const t = bodyText();
        if (/\b([1-9]?\d|100)\s*%/.test(t)) return true;
        if (
          /yükleniyor|yukleniyor|loading/.test(t) &&
          !/kullanıcı adı|kullanici adi|username|password|şifre|sifre/.test(t)
        )
          return true;
      } catch {
        /* ignore */
      }
      return false;
    }

    function isPlayEl(el) {
      try {
        for (let i = 0; el && i < 10; i++) {
          const tag = (el.tagName || "").toLowerCase();
          const id = String(el.id || "").toLowerCase();
          const cls = String(el.className || "").toLowerCase();
          const aria = String(
            (el.getAttribute &&
              (el.getAttribute("aria-label") ||
                el.getAttribute("title") ||
                el.getAttribute("alt"))) ||
              ""
          ).toLowerCase();
          const tx = String(el.innerText || el.textContent || el.value || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (
            id.indexOf("play") >= 0 ||
            cls.indexOf("play") >= 0 ||
            aria.indexOf("play") >= 0 ||
            aria.indexOf("oyna") >= 0
          )
            return true;
          if (/^play$|^şimdi oyna$|^simdi oyna$|^oyna$|^play now$/.test(tx))
            return true;
          if (
            tx.length < 28 &&
            /(şimdi oyna|simdi oyna|play now|^play$)/.test(tx) &&
            (tag === "button" ||
              tag === "a" ||
              tag === "div" ||
              tag === "span" ||
              (el.getAttribute && el.getAttribute("role") === "button"))
          )
            return true;
          el = el.parentElement;
        }
      } catch {
        /* ignore */
      }
      return false;
    }

    function onUserGesture(ev, why) {
      try {
        if (coreRequested) return;
        const t = ev && ev.target;
        if (isPlayEl(t) || splashVisible()) requestHeavyCore(why || "gesture");
      } catch {
        /* ignore */
      }
    }

    function armPlayGate() {
      try {
        if (window !== window.top) return;
      } catch {
        return;
      }
      try {
        document.addEventListener(
          "pointerdown",
          (ev) => onUserGesture(ev, "pointerdown"),
          true
        );
        document.addEventListener(
          "mousedown",
          (ev) => onUserGesture(ev, "mousedown"),
          true
        );
        document.addEventListener(
          "click",
          (ev) => onUserGesture(ev, "click"),
          true
        );
        document.addEventListener(
          "touchstart",
          (ev) => onUserGesture(ev, "touch"),
          true
        );
      } catch {
        /* ignore */
      }
      let n = 0;
      const barWatch = () => {
        try {
          if (coreRequested) return;
          if (loadingBarVisible()) {
            requestHeavyCore("loading-bar");
            return;
          }
          n++;
          if (n < 120) setTimeout(barWatch, 250);
        } catch {
          setTimeout(barWatch, 400);
        }
      };
      setTimeout(barWatch, 400);
      try {
        window.addEventListener("pagehide", () => {
          try {
            sessionStorage.removeItem("__xb_play");
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
    }

    // MAIN stub asks for core after real login token (F5 / late auth)
    window.addEventListener("message", (ev) => {
      try {
        if (ev.source !== window) return;
        const d = ev.data;
        if (!d || typeof d !== "object") return;
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
      } catch {
        /* ignore */
      }
    });

    chrome.runtime.sendMessage({ type: "xb:boot" }, (reply) => {
      void chrome.runtime.lastError;
      if (!reply || !reply.ok) return;

      postBootstrap({
        nonce: KEY,
        homes: Array.isArray(reply.homes) ? reply.homes : [],
        questions:
          reply.questions && typeof reply.questions === "object"
            ? reply.questions
            : {},
        emojis: null,
      });

      if (reply.gate) pushToolGate(reply.gate);
      else ensureGateSoft();
      // Catalog: idle after Play / panel. Emoji: login sync → SW warm; panel catch-up.
      setInterval(ensureGateSoft, 30000);
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", armPlayGate, { once: true });
    } else {
      armPlayGate();
    }
  } catch {
    /* ignore */
  }
})();
