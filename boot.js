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

    /** Core’a sadece ev/soru bootstrap (hafif). Emoji ayrı ve gecikmeli. */
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

    /** Core Play sonrası enjekte olur — erken bootstrap kaçmasın diye tekrar gönder */
    function deliverPacksToCore() {
      deliverHomesToCore();
      try {
        requestPack();
      } catch {
        /* ignore */
      }
    }

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
              setTimeout(() => {
                try {
                  requestPack();
                } catch {
                  /* ignore */
                }
              }, 1800);
            }
          );
        } catch {
          coreRequested = false;
        }
      }, why === "auth" ? 60 : 120);
      // Content script yolu için de ev/emoji (inject beklemeden)
      setTimeout(deliverHomesToCore, 200);
      setTimeout(deliverHomesToCore, 700);
      setTimeout(() => {
        try {
          requestPack();
        } catch {
          /* ignore */
        }
      }, 1600);
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
        if (d.__xbNeedBoot === 1) {
          if (lastBootPayload) deliverHomesToCore();
          else {
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
              deliverHomesToCore();
            });
          }
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

      // Emoji pack only on demand from core (__xbPack) — never at nick screen
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
