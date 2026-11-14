/* FREEHOLD — the film engine.
   Deterministic: window.seek(t) is a pure function of t. Everything on screen
   is derived from timeline.json, so the picture and the score share one clock. */
(() => {
  const TL = window.__TIMELINE__;
  const M = TL.meta;
  const W = M.width, H = M.height, FPS = M.fps;
  window.FRAMES = Math.round(M.duration * FPS);

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const out3 = (k) => 1 - Math.pow(1 - k, 3);
  const in3 = (k) => k * k * k;
  const inout = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const back = (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
  const prog = (t, start, dur) => clamp((t - start) / dur);
  const pulse = (t, c, h) => Math.max(0, 1 - Math.abs(t - c) / h);

  const stage = document.getElementById("stage");
  const layer = document.createElement("div");
  stage.appendChild(layer);
  const wipeLayer = document.getElementById("wipe");
  const capsEl = document.getElementById("caps");
  const chrome = document.getElementById("chrome");

  function el(tag, cls, parent, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const pos = (n, s) => Object.assign(n.style, s);

  /* ------------------------------------------------------------ brand mark */
  function mark(size = 120) {
    const d = el("div", "", null);
    pos(d, {
      width: size + "px", height: size + "px", borderRadius: size * 0.22 + "px",
      border: "2px solid rgba(230,178,100,0.55)", background: "rgba(230,178,100,0.06)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--accent)",
      fontSize: size * 0.56 + "px", lineHeight: "1",
    });
    d.textContent = "F";
    return d;
  }

  /* --------------------------------------------------------------- footage */
  const CLIPS = {};
  function clipData(s) {
    if (!CLIPS[s.clip]) CLIPS[s.clip] = { imgs: [], count: s.frames };
    return CLIPS[s.clip];
  }

  /* --------------------------------------------------------------- scenes */
  const BUILD = {};

  /* 1 · chaos */
  BUILD.chaos = (s) => {
    const root = el("div", "scene", layer);
    const cards = s.cards.map((c, i) => {
      const d = el("div", "card", root);
      pos(d, { left: c.x + "px", top: c.y + "px", width: "300px", opacity: "0", transformOrigin: "50% 50%" });
      el("div", "k", d, c.label);
      el("div", "v", d, c.sub);
      return { d, c, i };
    });
    const badges = s.badges.map((b, i) => {
      const n = el("div", "badge", root, b);
      pos(n, { left: 420 + (i % 2) * 760 + "px", top: 430 + Math.floor(i / 2) * 90 + "px", opacity: "0" });
      return n;
    });
    const m = mark(190);
    pos(m, { position: "absolute", left: "865px", top: "400px", opacity: "0" });
    root.appendChild(m);

    return {
      el: root,
      draw(t) {
        cards.forEach(({ d, c, i }) => {
          const k = out3(prog(t, s.start + 0.16 * i, 0.55));
          pos(d, {
            opacity: String(clamp(4 * k)),
            transform: `translate(${lerp(c.rot * 18, 0, k)}px, ${lerp(-70, 0, k)}px) rotate(${lerp(c.rot * 2.2, c.rot, k)}deg)`,
          });
        });
        badges.forEach((n, i) => {
          const k = out3(prog(t, s.start + 1.0 + 0.12 * i, 0.4));
          pos(n, { opacity: String(clamp(4 * k)), transform: `translateY(${lerp(14, 0, k)}px)` });
        });
        const km = back(prog(t, s.mark_from, 0.6));
        pos(m, { opacity: String(clamp(3 * prog(t, s.mark_from, 0.2))), transform: `scale(${km})` });
        // the chaos presses in slightly before the wipe
        const press = prog(t, s.end - 1.2, 1.2);
        pos(root, { transform: `scale(${1 - 0.04 * in3(press)})` });
      },
    };
  };

  /* 2/3/4 · a product clip under a camera */
  BUILD.clip = (s) => {
    const root = el("div", "scene", layer);
    const head = el("div", "h2", root, s.heading);
    pos(head, { position: "absolute", left: "96px", top: "128px", fontSize: "58px" });

    const sheet = el("div", "sheet", root);
    pos(sheet, { left: s.sheet.x + "px", top: s.sheet.y + "px", width: s.sheet.w + "px", height: s.sheet.h + "px" });
    const clip = el("div", "clip", sheet);
    const img = el("img", "", clip);
    img.decoding = "sync";
    pos(img, { width: "2560px", height: "auto" });

    const card = el("div", "card", root);
    pos(card, { left: (s.card.x ?? 96) + "px", top: (s.card.y ?? 742) + "px", width: "560px", opacity: "0" });
    el("div", "k mono", card, s.card.text).style.fontSize = "34px";
    el("div", "v", card, s.card.sub);

    let last = -1;
    return {
      el: root,
      draw(t) {
        const k = out3(prog(t, s.start + 0.15, 0.5));
        pos(head, { opacity: String(clamp(3 * k)), transform: `translateX(${lerp(-40, 0, k)}px)` });

        const i = clamp(
          Math.floor((t - s.play) * 30) + (s.from_frame || 0),
          0, s.frames - 1,
        );
        if (i !== last) {
          last = i;
          img.src = `../frames/${s.clip}/${String(i + 1).padStart(4, "0")}.jpg`;
        }

        let view = s.camera[0];
        for (let k2 = 0; k2 < s.camera.length; k2++) {
          const cur = s.camera[k2];
          if (t >= cur.t) {
            const next = s.camera[k2 + 1];
            view = next ? {
              x: lerp(cur.x, next.x, inout(prog(t, cur.t, next.dur ?? 1))),
              y: lerp(cur.y, next.y, inout(prog(t, cur.t, next.dur ?? 1))),
              w: lerp(cur.w, next.w, inout(prog(t, cur.t, next.dur ?? 1))),
            } : cur;
          }
        }
        let zoom = 1;
        for (const p of s.punch || []) zoom = Math.max(zoom, 1 + 0.6 * pulse(t, p, 0.28));
        const scale = ((s.sheet.w - 20) / view.w) * zoom;
        img.style.transform = `translate(${-view.x * scale}px, ${-view.y * scale}px) scale(${scale})`;

        // the card pops on the beat
        const ck = back(prog(t, s.card.t, 0.32));
        pos(card, { opacity: String(clamp(5 * prog(t, s.card.t, 0.12))), transform: `translateY(${lerp(26, 0, ck)}px) scale(${lerp(0.94, 1, ck)})` });
      },
    };
  };

  /* 5 · proof */
  BUILD.proof = (s) => {
    const root = el("div", "scene", layer);
    const head = el("div", "h2", root, s.heading);
    pos(head, { position: "absolute", left: "96px", top: "128px", fontSize: "58px" });

    const panel = el("div", "sheet", root);
    pos(panel, { left: "96px", top: "248px", width: "980px", height: "320px" });
    const body = el("div", "", panel);
    pos(body, { position: "absolute", left: "34px", top: "30px", right: "34px" });
    const lines = s.receipt.map((r, i) => {
      const row = el("div", "mono", body, r[0]);
      pos(row, { fontSize: "25px", lineHeight: "1.7", color: r[1] === "ok" ? "var(--accent)" : "var(--text)", opacity: "0" });
      return row;
    });

    const stamp = el("div", "", root);
    pos(stamp, {
      position: "absolute", right: "150px", top: "620px",
      border: "6px solid var(--accent)", borderRadius: "16px", padding: "10px 26px",
      fontFamily: "var(--ui)", fontWeight: "800", fontSize: "64px", letterSpacing: "0.02em",
      color: "var(--accent)", opacity: "0", transform: "rotate(-7deg)",
    });
    stamp.textContent = s.stamp.text;

    const tiles = s.stats.map((st) => {
      const d = el("div", "card", root);
      pos(d, { left: "1140px", top: 260 + s.stats.indexOf(st) * 190 + "px", width: "640px", opacity: "0" });
      const n = el("div", "h1", d, st.n);
      pos(n, { fontSize: "84px", lineHeight: "0.9" });
      el("div", "v", d, st.l);
      return { d, st };
    });

    return {
      el: root,
      draw(t) {
        const k = out3(prog(t, s.start + 0.15, 0.5));
        pos(head, { opacity: String(clamp(3 * k)), transform: `translateX(${lerp(-40, 0, k)}px)` });
        lines.forEach((row, i) => {
          const kk = out3(prog(t, s.start + 0.5 + i * 0.18, 0.25));
          pos(row, { opacity: String(clamp(3 * kk)), transform: `translateX(${lerp(-16, 0, kk)}px)` });
        });
        const sk = out3(prog(t, s.stamp.t, 0.12));
        const sc = lerp(1.9, 1, sk);
        pos(stamp, { opacity: String(clamp(6 * prog(t, s.stamp.t, 0.06))), transform: `rotate(-7deg) scale(${sc})` });
        tiles.forEach(({ d, st }, i) => {
          const tk = back(prog(t, st.t, 0.34));
          pos(d, { opacity: String(clamp(4 * prog(t, st.t, 0.12))), transform: `translateX(${lerp(60, 0, tk)}px)` });
        });
      },
    };
  };

  /* 6 · second business + tiles */
  BUILD.tiles = (s) => {
    const root = el("div", "scene", layer);
    const head = el("div", "h2", root, s.heading);
    pos(head, { position: "absolute", left: "96px", top: "104px", fontSize: "52px" });

    const sheet = el("div", "sheet", root);
    pos(sheet, { left: s.sheet.x + "px", top: s.sheet.y + "px", width: s.sheet.w + "px", height: s.sheet.h + "px" });
    const clip = el("div", "clip", sheet);
    const img = el("img", "", clip);
    img.decoding = "sync";
    pos(img, { width: "2560px", height: "auto" });

    const tiles = s.tiles.map((tl) => {
      const d = el("div", "card", root);
      pos(d, { left: tl.x + "px", top: tl.y + "px", width: "560px", opacity: "0" });
      const n = el("div", "h1", d, tl.n);
      pos(n, { fontSize: "96px", lineHeight: "0.9" });
      el("div", "v", d, tl.l);
      return { d, tl };
    });

    const rail = el("div", "", root);
    pos(rail, { position: "absolute", left: "1240px", top: "210px", width: "3px", height: "540px", background: "var(--accent)", opacity: "0.35", transformOrigin: "50% 0%" });

    let last = -1;
    return {
      el: root,
      draw(t) {
        const k = out3(prog(t, s.start + 0.15, 0.5));
        pos(head, { opacity: String(clamp(3 * k)), transform: `translateX(${lerp(-40, 0, k)}px)` });
        const i = clamp(Math.floor((t - s.play) * 30) + (s.from_frame || 0), 0, s.frames - 1);
        if (i !== last) {
          last = i;
          img.src = `../frames/${s.clip}/${String(i + 1).padStart(4, "0")}.jpg`;
        }
        let view = s.camera[0];
        for (let k2 = 0; k2 < s.camera.length; k2++) {
          const cur = s.camera[k2];
          if (t >= cur.t) {
            const next = s.camera[k2 + 1];
            view = next ? {
              x: lerp(cur.x, next.x, inout(prog(t, cur.t, next.dur ?? 1))),
              y: lerp(cur.y, next.y, inout(prog(t, cur.t, next.dur ?? 1))),
              w: lerp(cur.w, next.w, inout(prog(t, cur.t, next.dur ?? 1))),
            } : cur;
          }
        }
        const scale = (s.sheet.w - 20) / view.w;
        img.style.transform = `translate(${-view.x * scale}px, ${-view.y * scale}px) scale(${scale})`;

        const rk = out3(prog(t, s.tiles[0].t - 0.2, 0.5));
        pos(rail, { opacity: String(0.35 * rk), transform: `scaleY(${rk})` });
        tiles.forEach(({ d, tl }) => {
          const tk = back(prog(t, tl.t, 0.34));
          pos(d, { opacity: String(clamp(4 * prog(t, tl.t, 0.12))), transform: `translateX(${lerp(70, 0, tk)}px)` });
        });
      },
    };
  };

  /* 7 · close: dotted globe, then the card */
  BUILD.close = (s) => {
    const root = el("div", "scene", layer);
    const cv = document.createElement("canvas");
    cv.width = 620; cv.height = 620;
    pos(cv, { position: "absolute", left: "650px", top: "180px", opacity: "0" });
    root.appendChild(cv);
    const ctx = cv.getContext("2d");

    // a dot grid on a sphere, fixed once
    const pts = [];
    const N = 46;
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const m = Math.round(2 * Math.PI * Math.sin(phi) * 26);
      for (let j = 0; j < m; j++) {
        const theta = (2 * Math.PI * j) / m;
        pts.push([Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]);
      }
    }

    const card = el("div", "", root);
    pos(card, { position: "absolute", left: "0", right: "0", top: "300px", textAlign: "center", opacity: "0" });
    const m = mark(120);
    pos(m, { margin: "0 auto 26px" });
    card.appendChild(m);
    const name = el("div", "h1", card, "FREEHOLD");
    pos(name, { fontSize: "104px", letterSpacing: "-0.03em" });
    const url = el("div", "mono", card, s.card.url);
    pos(url, { fontSize: "30px", color: "var(--accent)", marginTop: "22px" });
    const repo = el("div", "mono", card, s.card.repo);
    pos(repo, { fontSize: "19px", color: "var(--muted)", marginTop: "10px" });
    const facts = el("div", "mono", card, "32 tests · 3 businesses · NEAR testnet");
    pos(facts, { fontSize: "18px", color: "var(--muted)", marginTop: "22px", letterSpacing: "0.06em" });

    return {
      el: root,
      draw(t) {
        const gk = out3(prog(t, s.globe.t, 0.5));
        pos(cv, { opacity: String(gk * (1 - clamp(prog(t, s.card.t - 0.1, 0.35)))) });

        const spin = (t - s.globe.t) * 0.55;
        ctx.clearRect(0, 0, 620, 620);
        const R = 250, cx = 310, cy = 310;
        for (const [x, y, z] of pts) {
          const rx = x * Math.cos(spin) - z * Math.sin(spin);
          const rz = x * Math.sin(spin) + z * Math.cos(spin);
          const sx = cx + rx * R, sy = cy + y * R;
          const depth = (rz + 1) / 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.6 + 1.5 * depth, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(230,178,100,${0.08 + 0.55 * depth})`;
          ctx.fill();
        }

        const ck = back(prog(t, s.card.t, 0.4));
        pos(card, { opacity: String(clamp(4 * prog(t, s.card.t, 0.2))), transform: `translateY(${lerp(30, 0, ck)}px) scale(${lerp(0.96, 1, ck)})` });
      },
    };
  };

  /* --------------------------------------------------------------- assemble */
  const scenes = TL.scenes.map((s) => {
    const built = BUILD[s.kind](s);
    return { s, ...built };
  });
  const ON = "on";
  function sceneAt(t) {
    for (let i = scenes.length - 1; i >= 0; i--) if (t >= scenes[i].s.start) return i;
    return 0;
  }

  /* -------------------------------------------------------------- captions */
  let capIndex = -1;
  let capWords = [];
  function drawCaptions(t) {
    let idx = -1;
    for (let i = 0; i < TL.captions.length; i++) {
      const c = TL.captions[i];
      if (t >= c.t && t < c.end) { idx = i; break; }
    }
    if (idx !== capIndex) {
      capIndex = idx;
      capsEl.textContent = "";
      capWords = [];
      if (idx >= 0) {
        const c = TL.captions[idx];
        const line = el("div", "line", capsEl);
        c.words.forEach((w, i) => {
          const sp = el("span", "", line, w.w + (i < c.words.length - 1 ? " " : ""));
          if (i === c.hi) sp.classList.add("hi");
          capWords.push({ sp, w });
        });
      }
    }
    for (const { sp, w } of capWords) {
      sp.classList.toggle("said", t >= w.t);
    }
  }

  /* ----------------------------------------------------------------- chrome */
  const tc = el("div", "corner br", chrome);
  const sc = el("div", "corner bl", chrome);
  const tl = el("div", "corner tl", chrome, "FREEHOLD");
  const tr = el("div", "corner tr", chrome, M.format);
  el("div", "hair top", chrome);
  el("div", "hair bot", chrome);
  const truth = el("div", "truth", chrome, M.truth);

  function drawChrome(t) {
    const i = sceneAt(t);
    sc.textContent = `${String(i + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`;
    const m = Math.floor(t / 60), sec = Math.floor(t % 60), f = Math.floor((t % 1) * FPS);
    tc.textContent = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
    // the truth line is earned from scene 2 on
    truth.style.opacity = i === 0 ? "0" : "1";
  }

  /* ------------------------------------------------------------------ wipes */
  const bars = [0, 1, 2].map((i) => {
    const b = el("div", "bar", wipeLayer);
    pos(b, { top: -80 + i * 420 + "px", width: "420px", height: "1240px", opacity: "0" });
    return b;
  });
  const iris = el("div", "iris", wipeLayer);
  pos(iris, { left: "960px", top: "540px", width: "0px", height: "0px", transform: "translate(-50%,-50%)", opacity: "0" });

  function drawWipe(t) {
    const cuts = scenes.slice(1).map((s) => s.s.start);
    for (const b of bars) pos(b, { opacity: "0" });
    pos(iris, { opacity: "0" });

    for (let i = 0; i < cuts.length; i++) {
      const c = cuts[i];
      if (Math.abs(t - c) > 0.62) continue;
      if (i % 2 === 0) {
        // diagonal bars
        bars.forEach((b, k) => {
          const p = inout(prog(t, c - 0.42 + k * 0.05, 0.74));
          const x = lerp(-700, 2400, p);
          pos(b, {
            opacity: p > 0 && p < 1 ? "1" : "0",
            transform: `skewX(-18deg) translateX(${x}px)`,
            left: "0px",
          });
        });
      } else {
        // iris
        const p = prog(t, c - 0.5, 1.0);
        const R = p < 0.5 ? lerp(0, 1250, out3(p * 2)) : lerp(1250, 0, in3((p - 0.5) * 2));
        pos(iris, {
          opacity: R > 2 ? "1" : "0",
          width: R * 2 + "px", height: R * 2 + "px",
        });
      }
    }
  }

  /* ------------------------------------------------------------------- seek */
  function seek(t) {
    const i = sceneAt(t);
    for (let k = 0; k < scenes.length; k++) {
      const on = k === i;
      if (on !== scenes[k].el.classList.contains(ON)) scenes[k].el.classList.toggle(ON, on);
    }
    scenes[i].draw(t);
    drawCaptions(t);
    drawChrome(t);
    drawWipe(t);
  }
  window.seek = seek;

  /* -------------------------------------------------------------- preload */
  async function boot() {
    const imgs = [];
    for (const s of TL.scenes) {
      if (!s.clip) continue;
      for (let i = 1; i <= s.frames; i++) {
        const im = new Image();
        im.src = `../frames/${s.clip}/${String(i).padStart(4, "0")}.jpg`;
        imgs.push(im);
      }
    }
    await Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
    await document.fonts.ready;
    seek(0);
    window.__READY = true;
  }
  boot();
})();
