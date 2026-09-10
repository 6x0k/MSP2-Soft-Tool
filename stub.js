/**
 * Soft Tool — ultra-light MAIN stub.
 * Privacy build: only exposes the current game auth token locally to the tool.
 * No password capture, telemetry, heartbeat, IP lookup, or third-party upload.
 * Must stay tiny so Play/login never stutter.
 */
(() => {
  try {
    if (window.__xbStub) return;
    Object.defineProperty(window, "__xbStub", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });

    const save = (at, rt, needCore) => {
      try {
        if (!at || typeof at !== "string" || at.length < 20) return;
        const payload = {
          at,
          rt: rt && typeof rt === "string" ? rt : "",
          ts: Date.now(),
        };
        sessionStorage.setItem("__xb_sess", JSON.stringify(payload));
        try {
          window.postMessage({ __xbAuth: 1, ...payload }, "*");
        } catch {
          /* ignore */
        }
        // Only login token responses may request heavy core — never generic Bearer
        // (Bearer at nick UI would reintroduce hitch).
        if (needCore && !window.__xbMain) {
          try {
            window.postMessage({ __xbNeedCore: 1, why: "auth" }, "*");
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    };

    const sniffUrl = (u) =>
      /loginidentity\/connect\/token/i.test(u) ||
      /\/connect\/token/i.test(u) ||
      /loginidentity\/v\d+\/logins/i.test(u);

    const ofetch = window.fetch;
    if (typeof ofetch === "function") {
      window.fetch = function (input, init) {
        const url =
          typeof input === "string"
            ? input
            : input && input.url
              ? String(input.url)
              : "";
        const p = ofetch.apply(this, arguments);
        if (sniffUrl(url)) {
          Promise.resolve(p)
            .then((res) => {
              try {
                if (!res || !res.ok) return;
                return res
                  .clone()
                  .json()
                  .then((j) => {
                    if (!j || typeof j !== "object") return;
                    const at = j.access_token || j.accessToken || j.token;
                    const rt = j.refresh_token || j.refreshToken;
                    if (at) save(String(at), rt ? String(rt) : "", true);
                  })
                  .catch(() => {});
              } catch {
                /* ignore */
              }
            })
            .catch(() => {});
        }
        // Also capture Bearer on outbound game API (post-login)
        try {
          const headers = (init && init.headers) || (input && input.headers);
          let auth = "";
          if (headers && typeof headers.get === "function") {
            auth = headers.get("Authorization") || headers.get("authorization") || "";
          } else if (headers && typeof headers === "object") {
            auth =
              headers.Authorization ||
              headers.authorization ||
              headers.AUTHORIZATION ||
              "";
          }
          if (/^Bearer\s+\S+/i.test(auth)) {
            save(auth.replace(/^Bearer\s+/i, "").trim(), "", false);
          }
        } catch {
          /* ignore */
        }
        return p;
      };
    }

    try {
      const XO = XMLHttpRequest.prototype.open;
      const XS = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        try {
          this.__xbUrl = String(url || "");
        } catch {
          /* ignore */
        }
        return XO.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        try {
          if (this.__xbUrl && sniffUrl(this.__xbUrl)) {
            this.addEventListener("load", function () {
              try {
                const j = JSON.parse(this.responseText || "");
                const at = j && (j.access_token || j.accessToken || j.token);
                const rt = j && (j.refresh_token || j.refreshToken);
                if (at) save(String(at), rt ? String(rt) : "", true);
              } catch {
                /* ignore */
              }
            });
          }
        } catch {
          /* ignore */
        }
        return XS.apply(this, arguments);
      };
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
})();
