/* Hareket sistemi: her kaynak bir METAFOR'dan türeyen beş katman taşır.
 *   yapı (çerçeve)  ·  canlı arka plan  ·  giriş hareketi  ·  sayı hareketi  ·  tempo
 * İlkeler: hareket süs değil anlam taşır; saniyede 3'ten fazla yanıp sönme yok (WCAG 2.3.1);
 * zoom/dönme/paralaks yok (vestibüler); işletim sistemi ya da düğme ile "hareketi azalt" her şeyi sakinleştirir. */
(() => {
  "use strict";
  const W = window.Wrapped, K = W.kit, HOOKS = W.hooks, { clamp, rng, pad } = K;
  const sys = matchMedia("(prefers-reduced-motion: reduce)");
  const stored = () => { try { return localStorage.getItem("wf-calm"); } catch { return null; } };

  /* ---- metafor tablosu (kaynağın tema "skin" adına göre; theme.motion ile ezilebilir) ---- */
  const SPEC = {
    github: { metaphor: "git graph",       fx: "branches", chrome: "git", enter: "merge", count: "count", tempo: 1 },
    chess:  { metaphor: "satranç tahtası", fx: "board",   chrome: "chess", enter: "file",   count: "tick",  tempo: 1 },
    chat:   { metaphor: "sohbet ekranı",   fx: "bubbles", chrome: "chat",  enter: "pop",    count: "count", tempo: 1 },
    anime:  { metaphor: "manga paneli",    fx: "speed",   chrome: "anime", enter: "slam",   count: "punch", tempo: 0.92 },
    music:  { metaphor: "çalar",           fx: "bars",    chrome: "music", enter: "bounce", count: "pulse", tempo: 0.95 },
    film:   { metaphor: "projeksiyon",     fx: "grain",   chrome: "film",  enter: "focus",  count: "slot",  tempo: 1.15 },
    code:   { metaphor: "terminal",        fx: "code",    chrome: "code",  enter: "type",   count: "type",  tempo: 1 },
    team:   { metaphor: "skor tabelası",   fx: "stripes", chrome: "team",  enter: "skew",   count: "tick",  tempo: 0.95 },
  };
  const rrect = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };

  /* ---- canlı arka plan efektleri: make(w, h, R) -> { draw(ctx, t, fg) } ---- */
  const FX = {
    squares(w, h, R) {                                         // katkı grafiği hücreleri seyrek parlar
      const s = Math.max(24, Math.round(w / 12)), cols = Math.ceil(w / s) + 1, n = cols * (Math.ceil(h / s) + 1), ph = Array.from({ length: n }, () => R()), sp = Array.from({ length: n }, () => 0.3 + R() * 0.45);
      return { draw(c, t, fg) { c.fillStyle = fg; for (let i = 0; i < n; i++) { const k = Math.sin(t * sp[i] + ph[i] * 6.283); if (k < 0.6) continue; c.globalAlpha = 0.04 + 0.1 * ((k - 0.6) / 0.4); c.fillRect((i % cols) * s + 2, Math.floor(i / cols) * s + 2, s - 4, s - 4); } c.globalAlpha = 1; } };
    },
    board(w, h, R) {                                           // dama dalgası + gezen at
      const n = 8, s = w / n, rows = Math.ceil(h / s), mv = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], path = [[3, Math.floor(rows / 2)]];
      for (let i = 0; i < 120; i++) { const [x, y] = path[i]; const ok = mv.filter(([a, b]) => x + a >= 0 && x + a < n && y + b >= 0 && y + b < rows); const m = ok[Math.floor(R() * ok.length)]; path.push([x + m[0], y + m[1]]); }
      return { draw(c, t, fg) {
        c.fillStyle = fg; for (let r = 0; r < rows; r++) for (let q = 0; q < n; q++) { if ((r + q) % 2) continue; c.globalAlpha = 0.03 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.9 - (q + r) * 0.55)); c.fillRect(q * s, r * s, s, s); }
        const cyc = 1.9, k = Math.floor(t / cyc) % 119, p = clamp((t - Math.floor(t / cyc) * cyc) / 0.6, 0, 1), e = 1 - (1 - p) ** 3, a = path[k], b = path[k + 1], x = (a[0] + (b[0] - a[0]) * e) * s, y = (a[1] + (b[1] - a[1]) * e) * s;
        c.globalAlpha = 0.22; c.strokeStyle = fg; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, s - 6, s - 6); c.globalAlpha = 0.1; c.beginPath(); c.moveTo(a[0] * s + s / 2, a[1] * s + s / 2); c.lineTo(x + s / 2, y + s / 2); c.stroke(); c.globalAlpha = 1;
      } };
    },
    bubbles(w, h, R) {                                         // yükselen sohbet balonları + yazıyor noktaları
      const B = Array.from({ length: 8 }, (_, i) => ({ right: i % 2 === 1, bw: w * (0.22 + R() * 0.28), y0: R() * (h + 80), v: 7 + R() * 9, a: 0.06 + R() * 0.06, off: w * (0.05 + R() * 0.1) }));
      return { draw(c, t, fg) {
        c.fillStyle = fg; for (const b of B) { const y = h + 40 - ((b.y0 + t * b.v) % (h + 80)), f = Math.min(1, y / (h * 0.15), (h - y) / (h * 0.1)); if (f <= 0) continue; c.globalAlpha = b.a * clamp(f, 0, 1); rrect(c, b.right ? w - b.off - b.bw : b.off, y, b.bw, h * 0.034, h * 0.017); }
        for (let i = 0; i < 3; i++) { c.globalAlpha = 0.1 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3 + i * 0.9)); c.beginPath(); c.arc(w * 0.1 + i * 12, h * 0.86, 3.4, 0, 6.283); c.fill(); } c.globalAlpha = 1;
      } };
    },
    speed(w, h, R) {                                           // manga hız çizgileri + yarım ton noktalar
      const cx = w * 0.5, cy = h * 0.46, L = Array.from({ length: 44 }, (_, i) => ({ a: (i / 44) * 6.283 + R() * 0.1, wd: 0.012 + R() * 0.02, r0: h * (0.3 + R() * 0.12), r1: h * (0.75 + R() * 0.35), ph: R() * 6.283 }));
      return { draw(c, t, fg) {
        c.fillStyle = fg; for (const l of L) { const r1 = l.r1 * (1 + 0.05 * Math.sin(t * 1.6 + l.ph)); c.globalAlpha = Math.max(0, 0.055 + 0.045 * Math.sin(t * 1.9 + l.ph)); c.beginPath(); c.moveTo(cx + Math.cos(l.a) * l.r0, cy + Math.sin(l.a) * l.r0); c.lineTo(cx + Math.cos(l.a - l.wd) * r1, cy + Math.sin(l.a - l.wd) * r1); c.lineTo(cx + Math.cos(l.a + l.wd) * r1, cy + Math.sin(l.a + l.wd) * r1); c.fill(); }
        const sp = 13, rad = h * 0.34, off = (t * 4) % sp; c.globalAlpha = 0.09; for (let gx = -sp; gx < rad; gx += sp) for (let gy = h - rad; gy < h + sp; gy += sp) { const d = Math.hypot(gx + off, h - gy); if (d > rad) continue; c.beginPath(); c.arc(gx + off, gy, 2.4 * (1 - d / rad), 0, 6.283); c.fill(); } c.globalAlpha = 1;
      } };
    },
    bars(w, h, R) {                                            // ekolayzer: yumuşak vuruşla zıplayan çubuklar
      const n = 26, bw = w / n, ph = Array.from({ length: n }, () => R() * 6.283), sp = Array.from({ length: n }, () => 1.4 + R() * 1.8);
      return { draw(c, t, fg) { const env = Math.exp(-((t * 1.7) % 1) * 3.2); c.fillStyle = fg; c.globalAlpha = 0.12; for (let i = 0; i < n; i++) { const v = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * sp[i] + ph[i])) + 0.22 * env * (0.4 + 0.6 * (((i * 37) % 11) / 10)), bh = h * 0.26 * v; rrect(c, i * bw + bw * 0.15, h * 0.9 - bh, bw * 0.7, bh, bw * 0.25); } c.globalAlpha = 1; } };
    },
    grain(w, h, R) {                                           // film tanesi, vinyet, çizik, toz; titreme <1 Hz ve %3 genlik
      const dust = Array.from({ length: 14 }, () => ({ x: R() * w, y: R() * h, vx: (R() - 0.5) * 6, vy: 3 + R() * 6, ph: R() * 6.283 })); let gt = -1, g = [];
      return { draw(c, t, fg) {
        const k = Math.floor(t * 12); if (k !== gt) { gt = k; g = Array.from({ length: 110 }, () => [R() * w, R() * h, R() < 0.5 ? 1 : 2]); }
        c.fillStyle = fg; c.globalAlpha = 0.09; for (const p of g) c.fillRect(p[0], p[1], p[2], p[2]);
        const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.34)"); c.globalAlpha = 1; c.fillStyle = gr; c.fillRect(0, 0, w, h);
        const ph = (t / 3.1) % 1; if (ph < 0.07) { c.globalAlpha = 0.16 * (1 - ph / 0.07); c.fillStyle = fg; c.fillRect(((Math.floor(t / 3.1) * 977) % 100) / 100 * w, 0, 1, h); }
        c.globalAlpha = 0.025 + 0.02 * Math.sin(t * 4.8); c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
        c.fillStyle = fg; for (const d of dust) { c.globalAlpha = 0.1 + 0.06 * Math.sin(t * 2 + d.ph); c.fillRect(((d.x + d.vx * t) % w + w) % w, ((d.y + d.vy * t) % h + h) % h, 1.6, 1.6); } c.globalAlpha = 1;
      } };
    },
    code(w, h, R) {                                            // yavaş akan kod sütunları
      const cs = 20, cols = Math.floor(w / cs), G = "01{}</>=();+-*&|#", C = Array.from({ length: cols }, () => ({ y: R() * h, v: 26 + R() * 44, len: 6 + Math.floor(R() * 8), on: R() < 0.45 }));
      return { draw(c, t, fg) { c.fillStyle = fg; c.font = '13px "JetBrains Mono",monospace'; C.forEach((col, i) => { if (!col.on) return; for (let k = 0; k < col.len; k++) { const y = (col.y + t * col.v - k * cs) % (h + col.len * cs); c.globalAlpha = 0.12 * (1 - k / col.len); c.fillText(G[(i * 7 + k * 13 + Math.floor(t * 1.5 + k)) % G.length], i * cs + 2, y); } }); c.globalAlpha = 1; } };
    },
    stripes(w, h, R) {                                         // sürüklenen çizgiler + ara sıra gezen spot ışığı
      return { draw(c, t, fg) {
        c.save(); c.translate(w / 2, h / 2); c.rotate(-0.5); const sw = w * 0.09, gap = w * 0.09, off = (t * 14) % (sw + gap); c.fillStyle = fg; c.globalAlpha = 0.055; for (let x = -w * 1.4; x < w * 1.4; x += sw + gap) c.fillRect(x + off, -h, sw, h * 2); c.restore();
        const p = (t % 7) / 7; if (p < 0.35) { const x = -w * 0.4 + (p / 0.35) * w * 1.8, g = c.createLinearGradient(x, 0, x + w * 0.3, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.09)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x, 0, w * 0.3, h); } c.globalAlpha = 1;
      } };
    },
  };

  FX.branches = (w, h, R) => {                                   // yukarı akan commit noktaları ve dallar arası birleşme eğrileri
    const lanes = [0.1, 0.3, 0.7, 0.9].map((f, i) => ({ x: w * f, v: 9 + i * 3, ph: R() * 120, gap: 86 + R() * 40 })), merges = Array.from({ length: 5 }, () => ({ a: Math.floor(R() * 3), y0: R() * h, v: 8 + R() * 6 }));
    return { draw(c, t, fg) {
      c.strokeStyle = fg; c.fillStyle = fg; c.lineWidth = 2; c.globalAlpha = 0.07; lanes.forEach((l) => { c.beginPath(); c.moveTo(l.x, 0); c.lineTo(l.x, h); c.stroke(); });
      c.globalAlpha = 0.14; lanes.forEach((l) => { for (let y = -((t * l.v + l.ph) % l.gap); y < h; y += l.gap) { c.beginPath(); c.arc(l.x, y, 4.2, 0, 6.283); c.fill(); } });
      c.globalAlpha = 0.1; c.lineWidth = 2; merges.forEach((m) => { const y = h - ((m.y0 + t * m.v) % (h + 160)) + 80, a = lanes[m.a].x, b = lanes[m.a + 1 > 3 ? 3 : m.a + 1].x; c.beginPath(); c.moveTo(a, y); c.bezierCurveTo(a, y - 40, b, y + 40, b, y - 80); c.stroke(); });
      c.globalAlpha = 1;
    } };
  };

  /* ---- sayı hareketleri: (node, to, f) -> true ise sayaç kendi işini görür ---- */
  const COUNT = {
    tick(node, to, f, my) { const t0 = performance.now(); (function s(now) { if (my !== K.TOK()) return; const p = clamp((now - t0) / 1100, 0, 1); node.textContent = f(Math.round(to * (Math.floor(p * 14) / 14))); if (p < 1) requestAnimationFrame(s); else node.textContent = f(to); })(t0); },
    slot(node, to, f, my) { const fin = f(to), t0 = performance.now(), R = rng(7); (function s(now) { if (my !== K.TOK()) return; const p = clamp((now - t0) / 1250, 0, 1); let o = ""; for (let i = 0; i < fin.length; i++) o += /\d/.test(fin[i]) && p < 0.22 + 0.7 * ((i + 1) / fin.length) ? String(Math.floor(R() * 10)) : fin[i]; node.textContent = o; if (p < 1) requestAnimationFrame(s); else node.textContent = fin; })(t0); },
    type(node, to, f, my) { const fin = f(to), t0 = performance.now(); (function s(now) { if (my !== K.TOK()) return; const p = clamp((now - t0) / 950, 0, 1), k = Math.ceil(fin.length * p); node.textContent = fin.slice(0, k) + (p < 1 ? "▌" : ""); if (p < 1) requestAnimationFrame(s); else node.textContent = fin; })(t0); },
    punch(node, to, f, my) { const t0 = performance.now(); (function s(now) { if (my !== K.TOK()) return; const p = clamp((now - t0) / 900, 0, 1); node.textContent = f(Math.round(to * (1 - (1 - p) ** 4))); if (p < 1) requestAnimationFrame(s); else { node.textContent = f(to); node.classList.add("punch"); } })(t0); },
    pulse(node, to, f, my) { const t0 = performance.now(); (function s(now) { if (my !== K.TOK()) return; const p = clamp((now - t0) / 1000, 0, 1); node.textContent = f(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) requestAnimationFrame(s); else { node.textContent = f(to); node.classList.add("pulse"); } })(t0); },
  };

  /* ---- yapısal çerçeve (kaynağın metaforu) ---- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const SFX = ["BAAM!", "ZUUN!", "DOKI!", "KYAA!", "WOOSH!", "POW!", "SLASH!"];
  function buildChrome(kind, WW, n) {
    if (!kind) return null; const A = WW.A || WW, nm = (A.user && (A.user.name || A.user.login)) || "", ini = esc((nm || "?").slice(0, 1).toUpperCase()), yr = WW.year, brand = esc(WW.brand || ""), d = document.createElement("div"); d.className = "chrome c-" + kind;
    const blocks = ((A.poster && A.poster.blocks) || []).slice(0, 3).map((b) => `<span><b>${esc(b[0])}</b> ${esc(b[1])}</span>`).join("");
    const T = {
      film: `<div class="cf-t"><span class="cf-rec"><i></i>KAYIT</span><span>${brand}</span></div><div class="cf-b"><span class="cf-scene">SAHNE <b>01</b>/${pad(n)}</span><span>${yr}</span></div>`,
      chess: `<div class="cc-files">${[..."abcdefgh"].map((c) => `<i>${c}</i>`).join("")}</div><div class="cc-ranks">${[..."87654321"].map((c) => `<i>${c}</i>`).join("")}</div>`,
      chat: `<div class="cw-h"><span class="cw-av">${ini}</span><span class="cw-t"><b>${esc(nm)}</b><small>çevrimiçi</small></span></div><div class="cw-f"><span class="cw-in">Bir mesaj yaz</span><span class="cw-mic"></span></div>`,
      anime: `<div class="ca-border"></div><div class="ca-sfx"><b>BAAM!</b></div>`,
      music: `<div class="cm-bar"><span class="cm-art">${ini}</span><span class="cm-t"><b>${brand}</b><small>${esc(nm)}, ${yr}</small></span><span class="cm-ctl"><i class="pv"></i><i class="pl"></i><i class="nx"></i></span><span class="cm-track"><em class="mp-fill"></em></span></div>`,
      code: `<div class="cd-t"><i></i><i></i><i></i><span>~/${yr}-ozet — zsh</span></div><ol class="cd-g">${"<li></li>".repeat(40)}</ol><div class="cd-b"><span><b>main</b> ● UTF-8</span><span class="cd-pos">Ln 1, Col 1</span></div>`,
      git: `<div class="cg-rail">${"<i></i>".repeat(n)}</div><div class="cg-branch">⎇ main</div><div class="cg-head">HEAD → main · <b class="cg-hash">0000000</b></div>`,
      team: `<div class="ct-t"><span>${brand}</span><span>${yr}</span><span class="ct-n">SAHA 01/${pad(n)}</span></div><div class="ct-b">${blocks}</div>`,
    };
    d.innerHTML = T[kind] || ""; return d;
  }

  /* ---- durum ve yaşam döngüsü ---- */
  let cur = SPEC.github, frame = null, cv = null, ctx = null, fx = null, raf = 0, last = 0, fg = "#fff", calm = false, chrome = null, btn = null, nSlides = 1, theme = null, seed = 11;
  const stat = { n: 0, ms: 0 };
  calm = stored() === "1" || (stored() === null && sys.matches);
  const applyCalm = () => { document.documentElement.dataset.calm = calm ? "1" : ""; if (btn) { btn.setAttribute("aria-pressed", String(calm)); btn.title = calm ? "Hareketi aç" : "Hareketi azalt"; } };
  const setCalm = (v) => { calm = v; try { localStorage.setItem("wf-calm", v ? "1" : "0"); } catch { /* özel pencere */ } applyCalm(); if (calm) staticFrame(); };
  sys.addEventListener && sys.addEventListener("change", () => { if (stored() === null) { calm = sys.matches; applyCalm(); if (calm) staticFrame(); } });

  function size() { if (!cv || !frame) return; cv.width = Math.max(2, frame.clientWidth); cv.height = Math.max(2, frame.clientHeight); ctx = cv.getContext("2d"); fx = FX[cur.fx] ? FX[cur.fx](cv.width, cv.height, rng(seed)) : null; }
  function staticFrame() { if (!ctx || !fx) return; ctx.clearRect(0, 0, cv.width, cv.height); fx.draw(ctx, 0.4, fg); }
  function loop(now) {
    raf = requestAnimationFrame(loop); if (!fx || document.hidden || calm || (frame && frame.classList.contains("paused")) || now - last < 33) return; last = now;
    const t0 = performance.now(); ctx.clearRect(0, 0, cv.width, cv.height); fx.draw(ctx, now / 1000, fg); stat.n++; stat.ms += performance.now() - t0;
  }
  let curW = null;
  function setup(o) {
    teardown(); curW = o.W; frame = o.frame; theme = o.theme || {}; cur = { ...SPEC[theme.skin] || SPEC.github, ...(theme.motion || {}) }; nSlides = o.slides.length;
    frame.dataset.enter = cur.enter; frame.dataset.chrome = cur.chrome || "";
    cv = document.createElement("canvas"); cv.className = "fx"; cv.setAttribute("aria-hidden", "true"); frame.insertBefore(cv, frame.firstChild); size();
    chrome = buildChrome(cur.chrome, o.W, nSlides); if (chrome) frame.append(chrome);
    btn = document.createElement("button"); btn.type = "button"; btn.className = "calm-btn"; btn.setAttribute("aria-label", "Hareketi azalt"); btn.innerHTML = '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 9c3-4 6 4 9 0s6 4 9 0M3 16c3-4 6 4 9 0s6 4 9 0"/></svg>'; btn.onclick = () => setCalm(!calm); frame.append(btn);
    applyCalm(); stat.n = 0; stat.ms = 0; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); addEventListener("resize", onResize);
  }
  let rzT = 0; const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { size(); if (calm) staticFrame(); }, 150); };
  function teardown() {
    cancelAnimationFrame(raf); removeEventListener("resize", onResize);
    for (const n of [cv, chrome, btn]) if (n && n.remove) n.remove();
    if (frame) { delete frame.dataset.enter; delete frame.dataset.chrome; } cv = chrome = btn = ctx = fx = frame = null;
  }

  function onSlide(slideEl, s, idx) {
    if (!frame) return;
    [...slideEl.children].forEach((c, i) => c.style.setProperty("--i", i));
    fg = getComputedStyle(frame).getPropertyValue("--fg").trim() || "#fff"; if (calm) staticFrame();
    if (!chrome) return; const p = (q) => chrome.querySelector(q), no = pad(idx + 1);
    switch (cur.chrome) {
      case "film": p(".cf-scene b").textContent = no; break;
      case "chess": { const f = idx % 8, r = Math.floor(idx / 8) % 8; chrome.querySelectorAll(".cc-files i").forEach((e, i) => e.classList.toggle("on", i === f)); chrome.querySelectorAll(".cc-ranks i").forEach((e, i) => e.classList.toggle("on", i === 7 - r)); break; }
      case "anime": p(".ca-sfx b").textContent = SFX[idx % SFX.length]; break;
      case "music": { const e = p(".mp-fill"); e.style.animation = "none"; void e.offsetWidth; e.style.animation = ""; break; }
      case "code": p(".cd-pos").textContent = `Ln ${idx + 1}, Col ${1 + ((idx * 7) % 40)}`; break;
      case "git": { chrome.querySelectorAll(".cg-rail i").forEach((e, i) => { e.className = i < idx ? "done" : i === idx ? "on" : ""; }); p(".cg-hash").textContent = ((idx * 2654435761 + 40503) >>> 0).toString(16).padStart(8, "0").slice(0, 7); break; }
      case "team": p(".ct-n").textContent = `SAHA ${no}/${pad(nSlides)}`; break;
    }
  }

  /* ---- video (Reels) entegrasyonu ---- */
  const STAG = { rise: 0.07, file: 0.085, pop: 0.12, slam: 0.09, bounce: 0.075, focus: 0.2, type: 0.15, skew: 0.075, merge: 0.08 }, DUR = { rise: 0.5, file: 0.55, pop: 0.5, slam: 0.34, bounce: 0.6, focus: 0.95, type: 0.55, skew: 0.5, merge: 0.5 };
  HOOKS.reelEnter = (lt, i) => {
    if (calm) return null; const v = cur.enter, p = clamp((lt - 0.12 - i * (STAG[v] || 0.07)) / (DUR[v] || 0.5)), e = 1 - (1 - p) ** 3;
    switch (v) {
      case "file": return { a: e, dx: -(1 - e) * 120, s: 1 };
      case "pop": return { a: Math.min(1, p * 2), dy: (1 - e) * 40, s: 0.84 + 0.16 * e + 0.03 * Math.sin(Math.PI * p) };
      case "slam": return { a: Math.min(1, p * 3), s: 1 + (1 - e) * 0.4, r: -(1 - e) * 0.04 };
      case "bounce": return { a: Math.min(1, p * 2.5), dy: (1 - e) * 80 - Math.sin(Math.PI * p) * 12, s: 1 };
      case "focus": return { a: e, blur: (1 - e) * 10, s: 1 };
      case "type": return { a: 1, clip: p, s: 1 };
      case "skew": return { a: e, dx: (1 - e) * 160, sk: -(1 - e) * 0.2, s: 1 };
      case "merge": return { a: e, dx: -(1 - e) * 110, dy: (1 - e) * 70, s: 1 };
      default: return { a: e, dy: (1 - e) * 50, s: 1 };
    }
  };
  /* videoda çerçeve: slayttaki DOM çerçevenin canvas karşılığı (1080x1920) */
  HOOKS.reelChrome = (c, i, n, p, fg) => {
    if (!cur.chrome || !curW) return; const P = K.PAL, F = K.FGC, SANS = K.SANSf(), DISP = K.DISPf(), A = curW.A || curW, nm = (A.user && (A.user.name || A.user.login)) || "", yr = curW.year, brand = curW.brand || "", no = pad(i + 1), nn = pad(n);
    const T = (s, x, y, size, o = {}) => { c.save(); c.font = `${o.w || 700} ${size}px ${o.f || SANS}`; c.fillStyle = o.c || fg; c.textAlign = o.a || "left"; c.globalAlpha = o.al == null ? 1 : o.al; c.fillText(s, x, y); c.restore(); }, R = (x, y, w, h, r, col) => { c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };
    switch (cur.chrome) {
      case "film": R(0, 0, 1080, 134, 0, "#000"); R(0, 1786, 1080, 134, 0, "#000"); c.fillStyle = "#d33"; c.beginPath(); c.arc(70, 78, 11, 0, 6.283); c.fill(); T("KAYIT", 94, 90, 28, { c: "#d9cfb8" }); T(brand.toUpperCase(), 1010, 90, 28, { c: "#d9cfb8", a: "right" }); T(`SAHNE ${no}/${nn}`, 70, 1866, 28, { c: "#d9cfb8" }); T(String(yr), 1010, 1866, 28, { c: "#d9cfb8", a: "right" }); break;
      case "chess": "abcdefgh".split("").forEach((ch, k) => { const on = k === i % 8; if (on) R(k * 135 + 40, 1862, 56, 44, 10, fg); T(ch, k * 135 + 67, 1896, 34, { a: "center", c: on ? P.merge : fg, al: on ? 1 : 0.5 }); }); "87654321".split("").forEach((ch, k) => { T(ch, 1050, 330 + k * 160, 34, { a: "center", al: k === 7 - (Math.floor(i / 8) % 8) ? 1 : 0.5 }); }); break;
      case "chat": R(0, 0, 1080, 140, 0, "rgba(10,20,26,.94)"); c.fillStyle = P.open; c.beginPath(); c.arc(80, 86, 36, 0, 6.283); c.fill(); T((nm || "?").slice(0, 1).toUpperCase(), 80, 100, 38, { a: "center", c: F.open, f: DISP, w: 800 }); T(nm, 134, 86, 38, { c: "#fff" }); T("çevrimiçi", 134, 122, 26, { c: "#fff", al: 0.7 }); R(0, 1770, 1080, 150, 0, "rgba(10,20,26,.94)"); R(40, 1800, 860, 90, 45, "rgba(255,255,255,.94)"); T("Bir mesaj yaz", 84, 1858, 36, { c: "#6b7280" }); c.fillStyle = P.open; c.beginPath(); c.arc(970, 1845, 45, 0, 6.283); c.fill(); break;
      case "anime": c.strokeStyle = P.ink; c.lineWidth = 26; c.strokeRect(24, 24, 1032, 1872); R(70, 150, 270, 100, 0, "#fff"); c.strokeStyle = P.ink; c.lineWidth = 8; c.strokeRect(70, 150, 270, 100); T(["BAAM!", "ZUUN!", "DOKI!", "KYAA!", "WOOSH!", "POW!", "SLASH!"][i % 7], 205, 224, 70, { c: P.ink, f: DISP, w: 900, a: "center" }); break;
      case "music": R(50, 1690, 980, 180, 40, "rgba(10,10,10,.9)"); R(80, 1720, 100, 100, 18, P.merge); T((nm || "?").slice(0, 1).toUpperCase(), 130, 1790, 56, { a: "center", c: F.merge, f: DISP, w: 900 }); T(brand, 204, 1766, 40, { c: "#fff" }); T(`${nm}, ${yr}`, 204, 1810, 30, { c: "#fff", al: 0.7 }); c.fillStyle = "#fff"; c.beginPath(); c.arc(940, 1770, 34, 0, 6.283); c.fill(); R(80, 1848, 920, 10, 5, "rgba(255,255,255,.25)"); R(80, 1848, 920 * p, 10, 5, "#fff"); break;
      case "code": R(0, 0, 1080, 96, 0, "rgba(0,0,0,.4)"); ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((col, k) => { c.fillStyle = col; c.beginPath(); c.arc(54 + k * 40, 52, 13, 0, 6.283); c.fill(); }); T(`~/${yr}-ozet — zsh`, 190, 60, 28, { c: "#fff", f: DISP, al: 0.85 }); R(0, 1840, 1080, 80, 0, P.link); T("main ● UTF-8", 40, 1892, 28, { c: F.link || "#fff", f: DISP }); T(`Ln ${i + 1}, Col ${1 + ((i * 7) % 40)}`, 1040, 1892, 28, { c: F.link || "#fff", f: DISP, a: "right" }); break;
      case "team": R(0, 0, 1080, 100, 0, P.ink); T(brand.toUpperCase(), 50, 68, 32, { c: F.ink, f: DISP }); T(String(yr), 540, 68, 32, { c: F.ink, f: DISP, a: "center" }); T(`SAHA ${no}/${nn}`, 1030, 68, 32, { c: F.ink, f: DISP, a: "right" }); R(0, 1820, 1080, 100, 0, P.open); (((A.poster && A.poster.blocks) || []).slice(0, 3)).forEach((b, k) => T(`${b[0]} ${b[1]}`.toUpperCase(), 50 + k * 340, 1882, 30, { c: F.open, f: DISP })); break;
      case "git": c.strokeStyle = fg; c.globalAlpha = 0.35; c.lineWidth = 5; c.beginPath(); c.moveTo(40, 170); c.lineTo(40, 1760); c.stroke(); c.globalAlpha = 1; for (let k = 0; k < n; k++) { const y = 170 + (1590 * k) / Math.max(1, n - 1); c.fillStyle = k === i ? P.review : fg; c.globalAlpha = k === i ? 1 : k < i ? 0.8 : 0.35; c.beginPath(); c.arc(40, y, k === i ? 16 : 9, 0, 6.283); c.fill(); } c.globalAlpha = 1; T(`HEAD → main · ${((i * 2654435761 + 40503) >>> 0).toString(16).padStart(8, "0").slice(0, 7)}`, 70, 1880, 28, { al: 0.75 }); break;
    }
  };
  let rfx = null;
  HOOKS.reelInit = (w, h) => { rfx = FX[cur.fx] ? FX[cur.fx](w, h, rng(seed)) : null; };
  HOOKS.reelFx = (c, t, fgc) => { if (rfx && !calm) { c.save(); rfx.draw(c, t, fgc); c.restore(); } };

  HOOKS.setup = setup; HOOKS.teardown = teardown; HOOKS.slide = onSlide; HOOKS.tempo = () => cur.tempo || 1; HOOKS.calm = () => calm;
  HOOKS.count = (node, to, f) => { const fn = COUNT[cur.count]; if (!fn) return false; node.textContent = f(0); fn(node, to, f, K.TOK()); return true; };
  W.motion = { SPEC, FX, stats: () => ({ frames: stat.n, avgMs: stat.n ? stat.ms / stat.n : 0 }), isCalm: () => calm, setCalm };
})();
