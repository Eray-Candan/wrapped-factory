/* Wrapped Fabrikası — motor
   Kaynak eklentileri (sources/*.js) Wrapped.register({...}) ile kaydolur ve Wrapped.kit içindeki araçları kullanır. */
(() => {
  "use strict";

  /* =====================================================
     Yardımcılar
  ===================================================== */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const nf = new Intl.NumberFormat("tr-TR");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NOW = new Date(), THIS_YEAR = NOW.getFullYear();
  const pad = (n) => String(n).padStart(2, "0");
  const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseD = (iso) => new Date(iso + "T00:00:00");
  const fmtDay = (iso) => parseD(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const weekdayName = (iso) => parseD(iso).toLocaleDateString("tr-TR", { weekday: "long" });
  const WD = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const WD_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  let toastT = 0;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mkErr = (code, extra) => { const e = new Error(code); e.code = code; e.extra = extra; return e; };

  // Türkçe sayı ekleri: %40'ı, %50'si, %73'ü ... (okunuşun son sözcüğüne göre)
  function suf3(n) {
    n = Math.abs(Math.round(n));
    if (n === 0) return "ı";
    const o = n % 10; if (o) return { 1: "i", 2: "si", 3: "ü", 4: "ü", 5: "i", 6: "sı", 7: "si", 8: "i", 9: "u" }[o];
    const t = n % 100; if (t) return { 10: "u", 20: "si", 30: "u", 40: "ı", 50: "si", 60: "ı", 70: "i", 80: "i", 90: "ı" }[t];
    return n % 1000 ? "ü" : "i";
  }
  const pcAcc = (n) => `%${n}'${suf3(n)}`;
  const pcLoc = (n) => { const s = suf3(n); return `%${n}'${s}${/[iü]$/.test(s) ? "nde" : "nda"}`; };

  /* ---- Eklenti kaydı ---- */
  const PLUGINS = {};
  const HOOKS = {};                                          // hareket sistemi (motion.js) buraya bağlanır
  const calmNow = () => reduced || !!(HOOKS.calm && HOOKS.calm());
  const PLUG = (W) => PLUGINS[W.src];
  const cap = (s) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
  const ICONS = {};                       // kişilik simgeleri: eklentiler doldurur
  const DEFAULT_VOCAB = {
    noun: "katkı", plPoss: "katkılarının", doVerb: "yaptın", doVerb1: "yaptım", activeVerb: "kod yazdın", noBreak: "hiç ara vermedin", dayPoss: "gününün",
    weekdayVerb: "kod yazıyorsun", night: "Gece kuşusun.", morning: "Sabahçısın.", evening: "Akşamcısın.", day: "Mesai ruhlusun.", hoursLead: "En verimli saatin",
    totalLead: "Bu yıl toplam", streakLead: "En uzun serin", busyLead: "En yoğun günün", skyLead: "Yılın bir şehir olsaydı", skyTitle: "Kod şehrin", skyCard: "kod şehrim",
    introTail: "kodlama yılın", personaLead: "Kodlama kişiliğin", personaLead1: "Kodlama kişiliğim", cardLead: "Dev kartın hazır.", cardLead1: "Dev kartım", cardWho: "olarak sahadasın",
    cmpUp: "Kendinle yarışıp kazanıyorsun.", cmpDown: "Hayatın başka işleri de var, anlıyoruz.", streakLead1: "En uzun serim", streakTail: "gün üst üste", totalTail1: "yaptım.",
    streakLine: "gün üst üste", you: "sen", curStreak: "Şu an aktif serin", devName: "Dev kartı", skyName: "Kod şehri", introTail1: "kodlama yılım", streakLine1: "gün üst üste",
  };
  const V = (W) => ({ ...DEFAULT_VOCAB, ...((PLUG(W) && PLUG(W).vocab) || {}), ...(W.vocab || {}) });

  /* =====================================================
     Ortak aktivite analizi: günlük sayımlar ve olay saatlerinden seri, zirve, hafta ve saat dağılımı
  ===================================================== */
  function activity(W, o) {
    const todayISO = localISO(new Date()), days = (o.days || []).filter((d) => d.date <= todayISO);
    W.days = days; W.hasCal = days.length > 0;
    W.total = days.reduce((s, d) => s + d.count, 0); W.active = days.filter((d) => d.count > 0).length; W.elapsed = days.length;
    let best = { len: 0, s: 0, e: 0 }, cur = 0, cs = 0;
    days.forEach((d, i) => { if (d.count > 0) { if (!cur) cs = i; cur++; if (cur > best.len) best = { len: cur, s: cs, e: i }; } else cur = 0; });
    W.best = best;
    let k = days.length - 1; if (k >= 0 && days[k].count === 0) k--;
    let run = 0; while (k >= 0 && days[k].count > 0) { run++; k--; }
    W.currentStreak = run;
    W.busy = days.reduce((b, d, i) => (d.count > (b ? b.count : 0) ? { ...d, i } : b), null);
    W.weekday = Array(7).fill(0); W.month = Array(12).fill(0);
    for (const d of days) { const dt = parseD(d.date); W.weekday[(dt.getDay() + 6) % 7] += d.count; W.month[dt.getMonth()] += d.count; }
    W.weekendShare = W.total ? (W.weekday[5] + W.weekday[6]) / W.total : 0;
    W.topWeekday = W.weekday.indexOf(Math.max(...W.weekday)); W.topMonth = W.month.indexOf(Math.max(...W.month));
    W.avgActive = W.active ? W.total / W.active : 0;
    let g = { len: 0, s: 0, e: 0 }, zr = 0, rs = 0;                       // aktif günler arasındaki en uzun ara
    for (let i = 0; i < days.length; i++) { if (days[i].count === 0) { if (!zr) rs = i; zr++; } else { if (zr > g.len) g = { len: zr, s: rs, e: i - 1 }; zr = 0; } }
    W.gap = g;
    const hrs = Array(24).fill(0);
    for (const t of o.hourTimes || []) { const d = new Date(t); if (!isNaN(d)) hrs[d.getHours()]++; }
    const n = hrs.reduce((a, b) => a + b, 0);
    W.hours = n >= (o.minHours || 10) ? hrs : null; W.hourN = n;
    if (W.hours) {
      W.peakHour = hrs.indexOf(Math.max(...hrs));
      W.nightShare = [22, 23, 0, 1, 2, 3].reduce((s, h) => s + hrs[h], 0) / n;
      W.morningShare = [5, 6, 7, 8, 9].reduce((s, h) => s + hrs[h], 0) / n;
    }
    return W;
  }
  // Kart puanı: 35–99 arası yumuşak ölçek
  const scoreK = (x, kk) => Math.round(35 + 64 * (1 - Math.exp(-Math.max(x, 0) / kk)));
  const rarityOf = (o) => (o >= 82 ? "Efsane" : o >= 72 ? "Altın" : o >= 62 ? "Gümüş" : "Bronz");
  function finishCard(W, attrs) {
    W.scores = attrs.map(([k, v]) => ({ k, v: clamp(Math.round(v), 35, 99) }));
    W.overall = clamp(Math.round(W.scores.reduce((s, a) => s + a.v, 0) / W.scores.length), 45, 99); W.rarity = rarityOf(W.overall);
  }

  /* =====================================================
     Çizim yardımcıları
  ===================================================== */
  /* ---- Tema sistemi: her kaynak kendi palet, yazı tipi, motif ve geçiş stilini getirir ---- */
  const DEF_THEME = {
    id: "github", skin: "github", motif: "squares", wipe: "squares",
    display: '"Anybody","Arial Black",sans-serif', sans: '"Hanken Grotesk",system-ui,sans-serif',
    colors: { merge: "#6E40F2", open: "#138A3E", closed: "#E8453F", review: "#FFC933", link: "#1F6FEB", ink: "#14111F", paper: "#F6F8FA" },
    fg: { merge: "#fff", open: "#fff", closed: "#14111F", review: "#14111F", link: "#fff", ink: "#F6F8FA" },
  };
  const PAL = { ...DEF_THEME.colors }, FGC = { ...DEF_THEME.fg }, SKIN = { id: "github", motif: "squares", wipe: "squares" }, THEME = {};
  let DISP = DEF_THEME.display, SANS = DEF_THEME.sans;
  const SLOTS = ["merge", "open", "closed", "review", "link", "ink"];
  function applyTheme(t) {
    t = { ...DEF_THEME, ...(t || {}), colors: { ...DEF_THEME.colors, ...((t && t.colors) || {}) }, fg: { ...DEF_THEME.fg, ...((t && t.fg) || {}) } };
    Object.assign(PAL, t.colors); Object.assign(FGC, t.fg); Object.assign(SKIN, { id: t.skin, motif: t.motif, wipe: t.wipe }); DISP = t.display; SANS = t.sans;
    const r = document.documentElement.style;
    for (const k of SLOTS) { r.setProperty("--" + k, PAL[k]); r.setProperty("--fg-" + k, FGC[k]); THEME["t-" + k] = PAL[k]; }
    r.setProperty("--paper", PAL.paper); r.setProperty("--display", DISP); r.setProperty("--sans", SANS); document.documentElement.dataset.skin = t.skin; if (HOOKS.themeChanged) HOOKS.themeChanged(t.skin);
  }
  const THEME_LOADED = {};
  async function useTheme(t) {
    if (t && t.css && !THEME_LOADED[t.css]) THEME_LOADED[t.css] = new Promise((res) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = t.css; l.onload = () => res(true); l.onerror = () => res(false); document.head.append(l); setTimeout(() => res(false), 5000); });
    if (t && t.css) await THEME_LOADED[t.css];
    applyTheme(t);
    if (t && t.fontCheck) { try { await Promise.race([Promise.all(t.fontCheck.map((f) => document.fonts.load(f))), wait(2500)]); } catch { /* yedek yazı tipi */ } }
  }
  let LANDING = DEF_THEME;                                  // açılış ekranının teması (tek kaynaklı derlemede kaynağın kendi teması)
  applyTheme(DEF_THEME);
  const fgA = (slot, a) => `rgba(${hexRGB(FGC[slot]).join(",")},${a})`;
  const heatCols = (fg) => { const x = hexRGB(fg).join(","); return [0.16, 0.4, 0.62, 0.84].map((a) => `rgba(${x},${a})`).concat(fg); };
  let TOK = 0;                                              // slayt değişince eski animasyonlar durur
  function anim(ms, fn) {
    if (reduced) { fn(1, 1); return; }
    const my = TOK, t0 = performance.now();
    (function f(now) { if (my !== TOK) return; const p = clamp((now - t0) / ms, 0, 1); fn(1 - (1 - p) ** 3, p); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  const stretch = (c, v) => { try { c.fontStretch = v; } catch { /* eski tarayıcı */ } };
  function levelFn(days) {
    const v = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b), q = (p) => v[Math.floor((v.length - 1) * p)] || 1;
    const a = q(0.25), b = q(0.5), c = q(0.75);
    return (n) => (n <= 0 ? 0 : n <= a ? 1 : n <= b ? 2 : n <= c ? 3 : 4);
  }
  function heatGeom(days, w, gap, bands, minCols) {
    const first = (parseD(days[0].date).getDay() + 6) % 7, cols = Math.max(Math.ceil((first + days.length) / 7), minCols || 0), per = Math.ceil(cols / bands);
    const cell = (w - gap * (per - 1)) / per, bandH = cell * 7 + gap * 6, bgap = bands > 1 ? cell * 1.1 : 0;
    return { first, cols, per, cell, bandH, bgap, total: bands * bandH + (bands - 1) * bgap };
  }
  function drawHeat(ctx, days, o) {
    const bands = o.bands || 1, g = heatGeom(days, o.w, o.gap, bands, o.minCols), gap = o.gap, cell = g.cell, lvl = levelFn(days);
    const lim = (o.upto == null ? 1 : o.upto) * Math.ceil((g.first + days.length) / 7), dim = o.dim == null ? 0.28 : o.dim;
    days.forEach((d, i) => {
      const idx = g.first + i, c = Math.floor(idx / 7), r = idx % 7, a = clamp(lim - c, 0, 1);
      if (a <= 0) return;
      const band = Math.floor(c / g.per), cc = c % g.per, inHi = !o.hi || (i >= o.hi[0] && i <= o.hi[1]);
      ctx.globalAlpha = a * (inHi ? 1 : dim);
      ctx.fillStyle = o.colors[lvl(d.count)];
      ctx.beginPath(); ctx.roundRect(o.x + cc * (cell + gap), o.y + band * (g.bandH + g.bgap) + r * (cell + gap), cell, cell, cell * 0.22); ctx.fill();
    });
    ctx.globalAlpha = 1;
    return g.total;
  }
  function hexRGB(h) { h = h.trim().replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  const fgRGB = () => hexRGB(getComputedStyle(frame).getPropertyValue("--fg") || "#fff").join(",");
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  const fillBox = (root) => { const f = el("div", "fill"); root.append(f); return f; };
  function gfx(parent, w, h) { const cv = el("canvas", "gfx"); cv.width = w; cv.height = h; cv.style.aspectRatio = `${w}/${h}`; parent.append(cv); return cv; }

  /* ---- Yıl ısı haritası (sütun sütun dolar) ---- */
  function heatCanvas(parent, days, o = {}) {
    const W = 1060, bands = o.bands || 1, gap = bands > 1 ? 9 : 5, H = Math.ceil(heatGeom(days, W, gap, bands).total) + 2;
    const cv = gfx(parent, W, H), ctx = cv.getContext("2d"), f = fgRGB();
    const colors = [0.16, 0.4, 0.6, 0.8, 1].map((a) => `rgba(${f},${a})`);
    const draw = (upto) => { ctx.clearRect(0, 0, W, H); drawHeat(ctx, days, { x: 0, y: 1, w: W, gap, colors, upto, bands }); };
    draw(o.animate ? 0 : 1); if (o.animate) anim(o.ms || 1100, (e) => draw(e));
  }

  /* ---- Seri: kareler tek tek yanar ---- */
  function streakGrid(parent, n) {
    const W = 1060, cols = n <= 8 ? n : n <= 24 ? 8 : n <= 48 ? 12 : n <= 120 ? 20 : 30, rows = Math.ceil(n / cols), gap = Math.round(W * (cols > 12 ? 0.006 : 0.014));
    let cell = Math.min((W - gap * (cols - 1)) / cols, 170); cell = Math.min(cell, (760 - gap * (rows - 1)) / rows);
    const H = Math.ceil(cell * rows + gap * (rows - 1)) + 2, cv = gfx(parent, W, H), ctx = cv.getContext("2d"), f = fgRGB();
    const draw = (lit) => { ctx.clearRect(0, 0, W, H); for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${f},${i < lit ? 1 : 0.16})`; rr(ctx, (i % cols) * (cell + gap), Math.floor(i / cols) * (cell + gap) + 1, cell, cell, cell * 0.2); } };
    draw(0); anim(Math.min(1600, 450 + n * 55), (e) => draw(Math.round(n * e)));
  }

  /* ---- En yoğun gün: çevresindeki 15 günün zirve grafiği ---- */
  function spikeChart(root, S) {
    const b = S.busy, lo = Math.max(0, b.i - 7), hi = Math.min(S.days.length - 1, b.i + 7), win = S.days.slice(lo, hi + 1);
    const mx = Math.max(...win.map((d) => d.count), 1), box = el("div", "spike"), bars = el("div", "sp-bars"), lbl = el("div", "sp-lbl");
    win.forEach((d, k) => {
      const top = lo + k === b.i, i = el("i", top ? "top" : ""); i.dataset.h = Math.max(Math.round((d.count / mx) * 86), 1);
      if (top) i.append(el("em", "", nf.format(d.count)));
      bars.append(i); lbl.append(el("span", top ? "on" : "", String(parseD(d.date).getDate())));
    });
    box.append(bars, lbl);
    const ratio = (S.avgActive / mx) * 0.86;
    if (ratio < 0.84) { const a = el("div", "sp-avg"); a.style.bottom = `calc(6cqh + (100% - 6cqh) * ${ratio})`; a.append(el("span", "", "ortalama gün")); box.append(a); }
    root.append(box);
    after(() => bars.querySelectorAll("i").forEach((i) => { i.style.height = i.dataset.h + "%"; }));
  }

  /* ---- Saat: 24 saatlik radyal grafik ---- */
  function clockChart(parent, hrs, peak) {
    const W = 1000, cv = gfx(parent, W, W), ctx = cv.getContext("2d"), f = fgRGB(), mx = Math.max(...hrs, 1), cx = W / 2, r0 = 170, rM = 440;
    const draw = (p) => {
      ctx.clearRect(0, 0, W, W); ctx.lineCap = "round";
      for (let h = 0; h < 24; h++) {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2, len = r0 + Math.max(0.03, hrs[h] / mx) * (rM - r0) * p;
        ctx.strokeStyle = `rgba(${f},${h === peak ? 1 : 0.42})`; ctx.lineWidth = h === peak ? 30 : 24;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * len, cx + Math.sin(a) * len); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${f},.95)`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; stretch(ctx, "normal");
      ctx.font = `700 36px ${SANS}`; [[0, "00"], [6, "06"], [12, "12"], [18, "18"]].forEach(([h, t]) => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; ctx.fillText(t, cx + Math.cos(a) * 476, cx + Math.sin(a) * 476 + 2); });
      stretch(ctx, "expanded"); ctx.font = `900 76px ${DISP}`; ctx.fillText(`${pad(peak)}:00`, cx, cx + 4);
    };
    draw(0); anim(1000, (e) => draw(e));
  }

  /* ---- 10×10 kare ızgara (her kare %1) ---- */
  function waffleCells(src) {                                  // src: [{pct, color}] (toplam 100'ü geçmeyen paylar)
    const items = src.map((l) => ({ pct: l.pct, color: PAL[l.color] || l.color })), rest = 100 - items.reduce((a, b) => a + b.pct, 0);
    if (rest > 0.5) items.push({ pct: rest, color: null });
    const n = items.map((i) => Math.floor(i.pct)), left = 100 - n.reduce((a, b) => a + b, 0);
    items.map((it, i) => [it.pct - Math.floor(it.pct), i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => n[i]++);
    const cells = []; items.forEach((it, i) => { for (let k = 0; k < n[i]; k++) cells.push(it.color); });
    return cells;
  }
  function drawWaffle(ctx, cells, x, y, size, gap, lit, dimColor) {
    const cell = (size - gap * 9) / 10;
    cells.forEach((col, i) => { ctx.fillStyle = i < lit ? col || dimColor : dimColor; if (i >= lit) ctx.globalAlpha = 0.4; rr(ctx, x + (i % 10) * (cell + gap), y + Math.floor(i / 10) * (cell + gap), cell, cell, cell * 0.2); ctx.globalAlpha = 1; });
  }
  function waffleCanvas(parent, items) {
    const W = 1000, cv = gfx(parent, W, W), ctx = cv.getContext("2d"), cells = waffleCells(items), dim = `rgba(${fgRGB()},.2)`;
    const draw = (lit) => { ctx.clearRect(0, 0, W, W); drawWaffle(ctx, cells, 0, 0, W, 16, lit, dim); };
    draw(0); anim(1300, (e) => draw(Math.round(100 * e)));
  }

  /* =====================================================
     Yeni grafikler: Kod Şehri (isometrik) ve dil zaman çizelgesi
  ===================================================== */
  const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function ramp(t) { const st = [[63, 47, 160], [110, 64, 242], [232, 69, 63], [255, 201, 51]], x = clamp(t, 0, 1) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(x)); return mixc(st[i], st[i + 1], x - i); }
  function skyGeom(days, w, bands) {
    const first = (parseD(days[0].date).getDay() + 6) % 7, cols = Math.ceil((first + days.length) / 7), per = Math.max(Math.ceil(cols / bands), 18);
    const u = w / (per + 7 * 0.55), k = u * 0.55, v = u * 0.42, stripH = 7 * v, maxH = u * 5.0, pitch = stripH + maxH * 0.52;
    return { first, cols, per, u, k, v, stripH, maxH, pitch, total: maxH + pitch * (bands - 1) + stripH + 6 };
  }
  function drawSkyline(ctx, S, o) {
    const bands = o.bands || 3, days = S.days, g = skyGeom(days, o.w, bands), mx = Math.max(...days.map((d) => d.count), 1), p = o.p == null ? 1 : o.p;
    const w = g.u * 0.78, dxr = g.k * 0.78, dyr = g.v * 0.78;
    const items = days.map((d, i) => { const idx = g.first + i, c = Math.floor(idx / 7), r = idx % 7, band = Math.floor(c / g.per); return { cc: c % g.per, r, band, i, n: d.count }; })
      .sort((a, b2) => a.band - b2.band || a.r - b2.r || a.cc - b2.cc);
    for (const it of items) {
      const sx = o.x + it.cc * g.u + it.r * g.k, sy = o.y + g.maxH + it.band * g.pitch + it.r * g.v, t = it.n / mx;
      const h = it.n > 0 ? Math.max(3, Math.pow(t, 0.62) * g.maxH * p) : 1.5, col = o.color(t, !!S.busy && it.i === S.busy.i, it.n === 0);
      ctx.fillStyle = col.left; ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx + dxr, sy + dyr - h); ctx.lineTo(sx + dxr, sy + dyr); ctx.lineTo(sx, sy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col.right; ctx.beginPath(); ctx.moveTo(sx + dxr, sy + dyr - h); ctx.lineTo(sx + dxr + w, sy + dyr - h); ctx.lineTo(sx + dxr + w, sy + dyr); ctx.lineTo(sx + dxr, sy + dyr); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col.top; ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx + w, sy - h); ctx.lineTo(sx + dxr + w, sy + dyr - h); ctx.lineTo(sx + dxr, sy + dyr - h); ctx.closePath(); ctx.fill();
    }
    return g.total;
  }
  function skylineCanvas(parent, S) {
    const W = 1060, g = skyGeom(S.days, 1000, 3), H = Math.ceil(g.total) + 20, cv = gfx(parent, W, H), ctx = cv.getContext("2d"), f = fgRGB().split(",").map(Number);
    const bgc = hexRGB(getComputedStyle(frame).getPropertyValue("--bg") || "#6E40F2"), M = (a) => rgba(mixc(bgc, f, a));
    const color = (t, peak, zero) => peak ? { top: "#FFE27A", left: "#E5B21A", right: "#B88A00" }
      : zero ? { top: M(0.2), left: M(0.12), right: M(0.08) }
      : { top: M(0.62 + 0.38 * t), left: M(0.34 + 0.3 * t), right: M(0.18 + 0.2 * t) };
    const draw = (p) => { ctx.clearRect(0, 0, W, H); drawSkyline(ctx, S, { x: 10, y: 6, w: 1000, p, color }); };
    draw(0); anim(1800, (e) => draw(e));
  }

  /* ---- Zaman çizelgesi: yıllara dağılmış noktalar (örn. dillerin çıkış yılları) ---- */
  function timelineCanvas(parent, o) {                         // o: {items:[{n,y,pct,color}], avg, year}
    const W = 1060, H = 470, cv = gfx(parent, W, H), ctx = cv.getContext("2d"), f = fgRGB();
    const items = o.items.slice().sort((a, b) => a.y - b.y), avg = o.avg, y0 = Math.floor((Math.min(...items.map((i) => i.y), avg) - 3) / 10) * 10, y1 = o.year + 3, X = (y) => 56 + ((y - y0) / (y1 - y0)) * (W - 112), AX = 270;
    const draw = (e) => {
      ctx.clearRect(0, 0, W, H); ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(${f},.55)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(36, AX); ctx.lineTo(W - 36, AX); ctx.stroke();
      ctx.fillStyle = `rgba(${f},.78)`; ctx.textAlign = "center"; ctx.textBaseline = "top"; stretch(ctx, "normal"); ctx.font = `600 34px ${SANS}`;
      for (let y = y0; y <= y1; y += 10) { ctx.fillRect(X(y) - 2, AX - 14, 4, 28); ctx.fillText(String(y), X(y), AX + 26); }
      ctx.setLineDash([12, 12]); ctx.strokeStyle = `rgba(${f},.95)`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(X(avg), 70); ctx.lineTo(X(avg), AX - 8); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${f},1)`; ctx.textBaseline = "alphabetic"; ctx.font = `800 42px ${SANS}`; ctx.fillText(o.avgLabel || "ortalaman", clamp(X(avg), 130, W - 130), 48);
      items.forEach((it, k) => {
        const r = (22 + 4.4 * Math.sqrt(it.pct)) * e, x = X(it.y), up = k % 2 === 0;
        ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x, AX, r, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${f},1)`; ctx.font = `800 40px ${SANS}`; ctx.textAlign = "center"; ctx.globalAlpha = e;
        ctx.fillText(it.n, clamp(x, 90, W - 90), up ? AX - r - 22 : AX + r + 92); ctx.globalAlpha = 1;
      });
    };
    draw(0); anim(1200, (e) => draw(e));
  }

  /* ---- Çizgi grafik (örn. rating yolculuğu) ---- */
  function lineChart(parent, pts, o = {}) {                    // pts: [{t, v}] zamana göre sıralı
    const W = 1060, H = 560, cv = gfx(parent, W, H), ctx = cv.getContext("2d"), f = fgRGB(), L = 70, R = 24, T = 84, B = 64;
    let mn = Math.min(...pts.map((p) => p.v)), mx = Math.max(...pts.map((p) => p.v)); if (mx === mn) { mx += 1; mn -= 1; }
    const pd = (mx - mn) * 0.12; mn -= pd; mx += pd;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1, X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R), Y = (v) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
    const pk = pts.reduce((b, p) => (p.v > b.v ? p : b), pts[0]);
    const draw = (e) => {
      ctx.clearRect(0, 0, W, H); stretch(ctx, "normal"); ctx.font = `600 30px ${SANS}`; ctx.textBaseline = "middle";
      for (let k = 0; k < 4; k++) { const v = mn + ((mx - mn) * k) / 3, y = Y(v); ctx.strokeStyle = `rgba(${f},.18)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.fillStyle = `rgba(${f},.7)`; ctx.textAlign = "left"; ctx.fillText(String(Math.round(v)), 0, y); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L + (W - L - R) * e + 2, H); ctx.clip();
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.v)) : ctx.moveTo(X(p.t), Y(p.v)))); ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.strokeStyle = `rgba(${f},1)`; ctx.stroke();
      ctx.lineTo(X(t1), H - B); ctx.lineTo(X(t0), H - B); ctx.closePath(); ctx.fillStyle = `rgba(${f},.16)`; ctx.fill(); ctx.restore();
      if (e >= 1) {
        ctx.fillStyle = PAL.review; ctx.beginPath(); ctx.arc(X(pk.t), Y(pk.v), 15, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${f},1)`; ctx.font = `800 40px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(`${Math.round(pk.v)}`, clamp(X(pk.t), 70, W - 70), Y(pk.v) - 28);
        ctx.font = `600 30px ${SANS}`; ctx.textAlign = "left"; ctx.fillStyle = `rgba(${f},.8)`; ctx.fillText(new Date(t0).toLocaleDateString("tr-TR", { month: "short" }), L, H - 14);
        ctx.textAlign = "right"; ctx.fillText(new Date(t1).toLocaleDateString("tr-TR", { month: "short" }), W - R, H - 14);
      }
    };
    draw(0); anim(1500, (e) => draw(e));
  }

  /* ---- Yatay sıralama çubukları ---- */
  function rankBars(root, rows, o = {}) {                       // rows: [{label, text, pct, hi}]
    const box = el("div", "rank"); 
    rows.forEach((r) => {
      const row = el("div", "rank-row" + (r.hi ? " hi" : "")), top = el("div", "rank-top");
      top.append(el("span", "rank-l", r.label), el("span", "rank-v", r.text || "")); const tr = el("div", "rank-tr"), i = el("i"); i.dataset.w = Math.max(2, Math.round(r.pct)); tr.append(i); row.append(top, tr); box.append(row);
    });
    root.append(box); after(() => box.querySelectorAll("i").forEach((i) => { i.style.width = i.dataset.w + "%"; }));
    return box;
  }

  /* ---- Açılış ve yükleme arka planları ---- */
  const GH_GREENS = ["#E1E6EB", "#9BE9A8", "#40C463", "#30A14E", "#216E39"];
  const hexMix = (a, b, t) => { const x = hexRGB(a), y = hexRGB(b); return `rgb(${[0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t)).join(",")})`; };
  const heroPal = () => (LANDING === DEF_THEME ? GH_GREENS : [hexMix(PAL.paper, PAL.ink, 0.08), hexMix(PAL.paper, PAL.open, 0.4), hexMix(PAL.paper, PAL.open, 0.72), PAL.open, hexMix(PAL.open, PAL.ink, 0.35)]);
  function heroHeat() {
    const cv = $("heroHeat"), ctx = cv.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = Math.max(innerHeight, cv.parentElement.offsetHeight);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = clamp(W / 26, 26, 54), gap = Math.round(cell * 0.14), cols = Math.ceil(W / (cell + gap)) + 1, rows = Math.ceil(H / (cell + gap)) + 1;
    let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lv = Array.from({ length: cols * rows }, (_, i) => { const c = i % cols; const wave = 0.5 + 0.5 * Math.sin(c / 3.1 + Math.floor(i / cols) / 2.4); const r = rnd() * 0.6 + wave * 0.5; return r < 0.42 ? 0 : r < 0.62 ? 1 : r < 0.82 ? 2 : r < 0.95 ? 3 : 4; });
    const t0 = performance.now(), dur = reduced ? 1 : 1500;
    (function draw(now) {
      const p = clamp((now - t0) / dur, 0, 1), reach = p * (cols + 6);
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < lv.length; i++) {
        const c = i % cols, r = Math.floor(i / cols), show = clamp(reach - c - r * 0.35, 0, 1);
        if (show <= 0) continue;
        ctx.globalAlpha = show; ctx.fillStyle = heroPal()[lv[i]];
        ctx.beginPath(); ctx.roundRect(c * (cell + gap), r * (cell + gap), cell, cell, cell * 0.2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (p < 1) requestAnimationFrame(draw);
    })(t0);
  }
  let loadTimer = 0;
  function loadAnim(on) {
    clearInterval(loadTimer);
    if (!on) return;
    const cv = $("loadHeat"), ctx = cv.getContext("2d"), cols = 53, rows = 7, cell = 20, gap = 4;
    cv.width = cols * (cell + gap); cv.height = rows * (cell + gap);
    const lv = new Array(cols * rows).fill(0);
    const paint = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      lv.forEach((l, i) => { ctx.fillStyle = ["rgba(255,255,255,.12)", "#9BE9A8", "#40C463", "#30A14E", "#216E39"][l]; ctx.beginPath(); ctx.roundRect((i % cols) * (cell + gap), Math.floor(i / cols) * (cell + gap), cell, cell, 4); ctx.fill(); });
    };
    paint();
    loadTimer = setInterval(() => { for (let k = 0; k < 9; k++) lv[Math.floor(Math.random() * lv.length)] = Math.floor(Math.random() * 5); paint(); }, 90);
  }


  const slideEl = $("slide"), frame = $("frame"), bars = $("bars"), storyEl = $("story");
  let SLIDES = [], idx = 0, fresh = true;
  const say = (t, sm) => el("p", "say" + (sm ? " sm" : ""), t);
  const big = (t, max, cls) => { const n = el("div", "big fit" + (cls ? " " + cls : ""), t); n.dataset.max = max || 30; return n; };
  const after = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
  const yearWord = (S) => (S.partial ? `${S.year} (şimdiye kadar)` : String(S.year));
  function countUp(node, to, fmt) {
    const f = fmt || nf.format; node.dataset.fit = f(to);
    if (calmNow() || to < 2) { node.textContent = f(to); return; }
    if (HOOKS.count && HOOKS.count(node, to, f)) return;
    node.textContent = f(0); anim(1100, (e) => { node.textContent = f(Math.round(to * e)); });
  }
  const splitMid = (t) => { const w = t.split(" "); if (w.length < 2) return t; let best = 1, bd = 1e9; for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length); if (d < bd) { bd = d; best = i; } } return w.slice(0, best).join(" ") + "\n" + w.slice(best).join(" "); };
  function fitAll(root) {
    const cs = getComputedStyle(root), avail = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), fw = frame.clientWidth;
    root.querySelectorAll(".fit").forEach((n) => {
      const max = ((+n.dataset.max || 30) * fw) / 100; n.style.fontSize = max + "px";
      const keep = n.textContent; if (n.dataset.fit) n.textContent = n.dataset.fit;
      const w = n.scrollWidth, box = n.parentElement === root ? avail : n.parentElement.clientWidth; n.textContent = keep;
      if (w > box) n.style.fontSize = Math.max((max * box) / w * 0.985, fw * 0.07) + "px";
    });
  }


  /* =====================================================
     Standart slayt kütüphanesi (metinler eklentinin vocab'ından gelir)
  ===================================================== */

  /* =====================================================
     Sahne sistemi: her kaynağın KENDİ verisinden çizilen canvas animasyonları.
     Aynı çizim fonksiyonu hem slaytta hem Reels videosunda çalışır: draw(ctx, w, h, t, cs)
  ===================================================== */
  const SCENES = {};                                         // Wrapped.scenes[kaynak] = { ad(W) -> tanımlayıcı }
  let STAGE_RESIZE = null;
  addEventListener("resize", () => { if (STAGE_RESIZE) STAGE_RESIZE(); });
  const sceneCs = (fgc, bgc) => ({ fg: fgc, bg: bgc, pal: PAL, f: FGC, sans: SANS, disp: DISP });
  function stage(root, draw, o = {}) {
    const box = el("div", "stage"), cv = el("canvas"); cv.dataset.scene = o.id || ""; box.append(cv); root.append(box);
    const my = TOK, dpr = Math.min(window.devicePixelRatio || 1, 2); let w = 0, h = 0, c = null, t = 0, last = 0, ok = true;
    const size = () => { w = box.clientWidth; h = box.clientHeight; cv.width = Math.max(2, Math.round(w * dpr)); cv.height = Math.max(2, Math.round(h * dpr)); c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const paint = (tt) => {
      const st = getComputedStyle(frame); c.clearRect(0, 0, w, h);
      try { draw(c, w, h, tt, sceneCs(st.getPropertyValue("--fg").trim() || "#fff", st.getPropertyValue("--bg").trim() || "#000")); } catch (e) { console.error("sahne hatası", o.id, e); ok = false; }
    };
    after(() => {
      if (!box.isConnected) return; size(); STAGE_RESIZE = () => { if (my === TOK && box.isConnected) { size(); paint(t); } };
      if (calmNow()) { paint(o.still != null ? o.still : o.dur || 4); return; }
      let prev = performance.now();
      (function f(now) {
        if (my !== TOK || !box.isConnected || !ok) return; requestAnimationFrame(f);
        if (frame.classList.contains("paused") || document.hidden) { prev = now; return; }
        if (now - last < 33) return; t += (now - prev) / 1000; prev = now; last = now; paint(HOOKS.stageClock ? HOOKS.stageClock() : t);
      })(prev);
    });
    return box;
  }
  function sceneSlide(d) {
    return { t: d.t || "t-open", dur: d.slide || 7.5, scene: d.id, r(root) {
      root.append(say(d.lead));
      if (d.big) { const n = big("0", d.bigSize || 40); root.append(n); if (d.big.text != null) { n.textContent = d.big.text; n.dataset.fit = d.big.text; } else countUp(n, d.big.v, d.big.f); }
      if (d.sub) root.append(say(d.sub, true));
      stage(root, d.draw, { id: d.id, dur: d.dur, still: d.still });
    } };
  }
  const sceneFor = (W, name) => { const S = SCENES[(W.A || W).src]; return S && S[name] ? sceneSlide(S[name](W)) : null; };

  const SL = {};
  const avatarNode = (S, cls) => {
    if (S.user.avatar) { const a = el("img", cls); a.src = S.user.avatar + (S.user.avatar.includes("?") ? "&" : "?") + "s=300"; a.alt = ""; a.referrerPolicy = "no-referrer"; return a; }
    return el("div", cls, (S.user.name || S.user.login || "?").slice(0, 1).toUpperCase());
  };
  SL.intro = (W) => ({ t: "t-merge", dur: 5, r(root) {
    const v = V(W), nm = W.user.name || W.user.login;
    root.append(avatarNode(W, "avatar"), say(nm), say(W.user.handle || "", true), el("div", "grow"), big(String(W.year), 46), say(v.introTail), say(W.partial ? "Henüz bitmedi, ama şimdiye kadarki hâli şu." : "Bütün yıl, tek bakışta.", true));
  } });
  SL.total = (W) => ({ t: "t-open", r(root) {
    const v = V(W), n = big("0", 46);
    root.append(say(v.totalLead), n, say(`${v.noun} ${v.doVerb}.`), say(`${nf.format(W.active)} farklı günde ${v.activeVerb}. Aktif gün oranı %${Math.round((W.active / W.elapsed) * 100)}.`, true));
    heatCanvas(fillBox(root), W.days, { animate: true, ms: 1300, bands: 3 }); countUp(n, W.total);
  } });
  SL.cmp = (W) => ({ t: "t-link", r(root) {
    const v = V(W), up = W.cmp.pct >= 0, n = big("0", 40), mx = Math.max(W.cmp.prev, W.cmp.now, 1);
    root.append(say(W.partial ? "Geçen yılın aynı dönemine göre" : "Geçen yıla göre"), n, say(up ? `daha fazla ${v.noun} ${v.doVerb}.` : `daha az ${v.noun} ${v.doVerb}.`), say(up ? v.cmpUp : v.cmpDown, true), el("div", "grow"));
    countUp(n, Math.abs(W.cmp.pct), (x) => `${up ? "+" : "−"}%${nf.format(x)}`);
    const rows = el("div", "cmp");
    [[String(W.year - 1), W.cmp.prev, "prev"], [String(W.year), W.cmp.now, "now"]].forEach(([lab, val, cls]) => { const r = el("div", "cmp-row"); r.append(el("span", "", lab), el("b", "", nf.format(val))); const bar = el("i", "cmp-bar " + cls); bar.dataset.w = Math.max(Math.round((val / mx) * 100), 2); r.append(bar); rows.append(r); });
    root.append(rows); after(() => rows.querySelectorAll(".cmp-bar").forEach((b) => { b.style.width = b.dataset.w + "%"; }));
  } });
  SL.streak = (W) => ({ t: "t-closed", r(root) {
    const v = V(W), n = big("0", 46);
    root.append(say(v.streakLead), n, say(`${v.streakLine}.`), say(`${fmtDay(W.days[W.best.s].date)} ile ${fmtDay(W.days[W.best.e].date)} arasında ${v.noBreak}.${W.currentStreak > 1 ? ` ${v.curStreak || "Şu an aktif serin"}: ${W.currentStreak} gün.` : ""}`, true));
    streakGrid(fillBox(root), W.best.len); countUp(n, W.best.len);
  } });
  SL.busy = (W) => ({ t: "t-review", r(root) {
    const v = V(W), ratio = W.avgActive ? (W.busy.count / W.avgActive).toFixed(1).replace(".", ",") : "1";
    root.append(say(v.busyLead), big(fmtDay(W.busy.date), 24), say(`${weekdayName(W.busy.date)} günü ${nf.format(W.busy.count)} ${v.noun} ${v.doVerb}.`), say(`Normal bir aktif ${v.dayPoss} ortalaması ${W.avgActive.toFixed(1).replace(".", ",")} ${v.noun}. O gün bunun ${ratio} katı.`, true), el("div", "grow"));
    spikeChart(root, W);
  } });
  SL.weekday = (W) => ({ t: "t-link", r(root) {
    const v = V(W), mx = Math.max(...W.weekday, 1);
    root.append(say("En çok"), big(WD[W.topWeekday], 24), say(`günleri ${v.weekdayVerb}.`), say(`${cap(v.plPoss)} ${pcAcc(Math.round(W.weekendShare * 100))} hafta sonuna denk geldi.`, true), el("div", "grow"));
    const w = el("div", "wk"); W.weekday.forEach((val, i) => { const c = el("div"), b = el("i", i === W.topWeekday ? "top" : ""); b.dataset.h = Math.max(Math.round((val / mx) * 100), 1); c.append(b, el("span", "", WD_SHORT[i])); w.append(c); });
    root.append(w); after(() => w.querySelectorAll("i").forEach((b) => { b.style.height = b.dataset.h + "%"; }));
  } });
  // takvim kartlarının tamamı (toplam, kıyas, seri, yoğun gün, hafta)
  SL.activity = (W) => {
    const L = [SL.total(W)];
    if (W.cmp) L.push(SL.cmp(W));
    if (W.best.len >= 2) L.push(SL.streak(W));
    if (W.busy && W.busy.count > 0) L.push(SL.busy(W));
    L.push(SL.weekday(W)); return L;
  };
  SL.hours = (W) => ({ t: "t-closed", r(root) {
    const v = V(W), h = W.peakHour, title = W.nightShare >= 0.3 ? v.night : W.morningShare >= 0.3 ? v.morning : h >= 17 ? v.evening : v.day;
    root.append(say(v.hoursLead), big(title, 18), say(W.hoursNote || `Son ${nf.format(W.hourN)} kayda göre. Saatler bu cihazın saat dilimiyle gösterilir.`, true));
    clockChart(fillBox(root), W.hours, h);
  } });
  SL.skyline = (W) => ({ t: "t-merge", dur: 7.5, r(root) {
    const v = V(W);
    root.append(say(v.skyLead), big(v.skyTitle, 22), say(`Her bina bir gün, yükseklik o günkü ${v.noun} sayısı. En yüksek bina ${fmtDay(W.busy.date)}: ${nf.format(W.busy.count)} ${v.noun}.`, true));
    skylineCanvas(fillBox(root), W);
  } });
  SL.words = (W) => ({ t: "t-review", dur: 7.5, r(root) {
    const wc = W.wordsCard, mx = wc.words[0].n, sizes = [27, 21, 17, 14, 12, 10.5];
    root.append(say(wc.title));
    wc.words.slice(0, 6).forEach((w, i) => { const b = big(w.w, Math.round(sizes[i] * (0.72 + 0.28 * (w.n / mx)) * 10) / 10); if (i % 2) b.style.opacity = ".6"; root.append(b); });
    root.append(el("div", "grow")); wc.lines.forEach((t, i) => root.append(say(t, i > 0)));
  } });
  SL.roast = (W) => ({ t: "t-closed", dur: 11, r(root) {
    root.append(say("Bir de bizden"), say("Verilerine bakarak, sevgiyle.", true), el("div", "grow"));
    const wrap = el("div", "notes"); W.roasts.forEach((t, i) => { const n = el("div", "note", t); n.style.setProperty("--r", [-1.6, 1.3, -0.9][i] + "deg"); wrap.append(n); });
    root.append(wrap, el("div", "grow"));
    const my = TOK; W.roasts.forEach((_, i) => setTimeout(() => { if (my === TOK && wrap.children[i]) wrap.children[i].classList.add("on"); }, reduced ? 0 : 500 + i * 2000));
  } });
  SL.persona = (W) => ({ t: "t-review", r(root) {
    const v = V(W), ic = el("div", "icon"); ic.innerHTML = ICONS[W.persona.k] || ICONS.default || "";
    root.append(say(v.personaLead), ic, big(splitMid(W.persona.k), 22, "wrap"), say(W.persona.d), el("div", "grow"));
    const c = el("div", "chips"); W.personaWhy.forEach((x) => c.append(el("span", "chip", x))); root.append(c);
  } });
  SL.cardReveal = (W) => ({ t: "t-merge", dur: 7, r(root) {
    const v = V(W), cls = { "Bronz": "bronz", "Gümüş": "gumus", "Altın": "altin", "Efsane": "efsane" }[W.rarity];
    root.append(say(v.cardLead), say(`${W.rarity} kart, ${W.overall} güç. ${W.persona.k} ${v.cardWho}.`, true));
    const holder = el("div", "dev-holder"); root.append(holder); holder.append(el("p", "say sm", "Kart çiziliyor…"));
    ensureCards(W).then((cards) => {
      const d = cards.find((c) => c.id === "dev"); if (!d || !holder.isConnected) return;
      const w = el("div", "dev-card " + cls), im = el("img", "dev-img"); im.src = d.url; im.alt = "Kart"; im.draggable = false;
      w.append(im, el("span", "shine")); holder.textContent = ""; holder.append(w); layoutDev();
    });
  } });
  SL.studio = (W) => ({ t: "t-ink", last: true, r(root) { studio(root, W); } });

  /* ---- Geçiş animasyonları: eski rengin şekilleri çözülerek yeni karta açılır ---- */
  function drawWipe(ctx, w, h, color, e, dir, style) {
    ctx.fillStyle = color; const cl = (x) => Math.min(1, Math.max(0, x));
    if (style === "checker" || style === "squares" || style === "circles") {
      const cols = 8, rows = 14, cw = w / cols, ch = h / rows, tot = cols * 0.55 + rows * 0.45;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let p, s;
        if (style === "squares") { const d = ((dir > 0 ? c * 0.55 + r * 0.45 : (cols - 1 - c) * 0.55 + (rows - 1 - r) * 0.45) / tot) * 0.5; p = cl((e - d) / 0.5); s = 1 - p * p; }
        else if (style === "checker") { p = cl((e - ((r + c) % 2) * 0.35) / 0.6); s = 1 - p; }
        else { const d = ((dir > 0 ? r : rows - 1 - r) / rows) * 0.4; p = cl((e - d) / 0.6); s = 1 - p * p; }
        if (p >= 1) continue;
        if (style === "circles") { ctx.beginPath(); ctx.arc(c * cw + cw / 2, r * ch + ch / 2, Math.max(cw, ch) * 0.78 * s, 0, 6.283); ctx.fill(); }
        else { const sw = cw * s + 0.6, sh = ch * s + 0.6; ctx.fillRect(c * cw + (cw - sw) / 2, r * ch + (ch - sh) / 2, sw, sh); }
      }
    } else if (style === "slash") {
      const n = 7, sl = h * 0.3, bw = (w + sl) / n;
      for (let i = 0; i < n; i++) {
        const k = dir > 0 ? i : n - 1 - i, p = cl((e - (k / n) * 0.45) / 0.55), wi = (bw + 1) * (1 - p * p); if (p >= 1) continue;
        const x0 = i * bw - sl; ctx.beginPath(); ctx.moveTo(x0 + sl, 0); ctx.lineTo(x0 + sl + wi, 0); ctx.lineTo(x0 + wi, h); ctx.lineTo(x0, h); ctx.closePath(); ctx.fill();
      }
    } else if (style === "bars") {
      const n = 16, bw = w / n;
      for (let i = 0; i < n; i++) { const seed = (i * 0.6180339) % 1, p = cl((e - seed * 0.4) / 0.6), hh = h * (1 - p * p); if (p >= 1) continue; ctx.fillRect(i * bw, dir > 0 ? h - hh : 0, bw + 0.6, hh); }
    } else if (style === "iris") {
      const p = cl(e), r = (Math.hypot(w, h) / 2) * 1.04 * (1 - (1 - p) ** 2); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.moveTo(w / 2 + r, h / 2); ctx.arc(w / 2, h / 2, r, 0, 6.283); ctx.fill("evenodd");
    } else if (style === "scan") {
      const n = 28, bh = h / n;
      for (let i = 0; i < n; i++) { const k = dir > 0 ? i : n - 1 - i, seed = (i * 0.7548776662) % 1, p = cl((e - (k / n) * 0.3 - seed * 0.15) / 0.55), ww = w * (1 - p * p); if (p >= 1) continue; i % 2 ? ctx.fillRect(0, i * bh, ww, bh + 0.6) : ctx.fillRect(w - ww, i * bh, ww, bh + 0.6); }
    } else if (style === "curtain") {
      const p = cl(e), s = 1 - p * p, half = (w / 2) * s; if (s <= 0) return;
      ctx.fillRect(0, 0, half + 0.6, h); ctx.fillRect(w - half - 0.6, 0, half + 0.6, h);
      ctx.fillStyle = "rgba(0,0,0,.14)"; const fold = Math.max(24, w / 18); for (let x = fold; x < half; x += fold * 2) { ctx.fillRect(x, 0, fold * 0.5, h); ctx.fillRect(w - x - fold * 0.5, 0, fold * 0.5, h); }
    }
  }
  function wipe(color, dir) {
    if (calmNow()) return;
    const old = frame.querySelector(".wipe"); if (old) old.remove();
    const w = frame.clientWidth, h = frame.clientHeight, cv = el("canvas", "wipe"); cv.width = w; cv.height = h; frame.append(cv);
    const ctx = cv.getContext("2d"), t0 = performance.now(), TOTAL = 430, style = SKIN.wipe;
    (function f(now) {
      const e = clamp((now - t0) / TOTAL, 0, 1); ctx.clearRect(0, 0, w, h); drawWipe(ctx, w, h, color, e, dir, style);
      if (e < 1 && cv.isConnected) requestAnimationFrame(f); else cv.remove();
    })(t0);
  }

  /* ---- Gezinme ---- */
  function buildBars() { bars.textContent = ""; SLIDES.forEach(() => { const i = el("i"); i.append(el("b")); bars.append(i); }); }
  function go(i, o = {}) {
    const prevTheme = (slideEl.className.match(/t-\w+/) || [])[0];
    idx = clamp(i, 0, SLIDES.length - 1); TOK++;
    const s = SLIDES[idx];
    slideEl.className = "slide " + s.t; slideEl.textContent = "";
    frame.classList.toggle("manual", !!(s.last || reduced));
    [...bars.children].forEach((b, k) => { b.className = k < idx ? "done" : k === idx ? "cur" : ""; });
    storyEl.style.setProperty("--amb", THEME[s.t]); frame.style.setProperty("--dur", (s.dur || 6) * (HOOKS.tempo ? HOOKS.tempo() : 1) + "s");
    s.r(slideEl); fitAll(slideEl); if (HOOKS.slide) HOOKS.slide(slideEl, s, idx, o);
    if (!fresh && prevTheme) wipe(THEME[prevTheme], o.dir || 1);
    fresh = false;
  }
  const next = () => { if (idx < SLIDES.length - 1) go(idx + 1, { dir: 1 }); };
  const prev = () => { if (idx > 0) go(idx - 1, { dir: -1 }); };
  bars.addEventListener("animationend", (e) => { if (e.animationName === "fill") next(); });
  let rz = 0; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (!$("story").hidden) { fitAll(slideEl); layoutDeck(); layoutDev(); } }, 120); });

  let downAt = 0, held = false, holdT = 0;
  const interactive = (t) => t.closest("button,a,select,input,.deck");
  frame.addEventListener("pointerdown", (e) => { if (interactive(e.target)) { downAt = 0; return; } downAt = 1; held = false; holdT = setTimeout(() => { held = true; frame.classList.add("paused"); }, 220); });
  const release = (e, cancel) => {
    clearTimeout(holdT); frame.classList.remove("paused");
    if (!downAt) return; downAt = 0;
    if (cancel || held) return;
    const r = frame.getBoundingClientRect(); (e.clientX - r.left < r.width * 0.35 ? prev : next)();
  };
  frame.addEventListener("pointerup", (e) => release(e, false));
  frame.addEventListener("pointercancel", (e) => release(e, true));
  frame.addEventListener("pointerleave", (e) => { if (downAt) release(e, true); });
  addEventListener("keydown", (e) => {
    if ($("story").hidden) return;
    if (SLIDES[idx] && SLIDES[idx].last && ST.deck) { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); deckMove(1); return; } if (e.key === "ArrowLeft") { deckMove(-1); return; } }
    if (e.key === "ArrowRight" || e.key === " ") { if (!interactive(e.target)) { e.preventDefault(); next(); } }
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "Escape") closeStory();
  });
  document.addEventListener("visibilitychange", () => frame.classList.toggle("paused", document.hidden));

  /* =====================================================
     Paylaşım kartları (1080×1920). İçerik y=285–1580 bandında:
     Story güvenli alanı ile 4:5 gönderi kırpımı (y=285–1635) birlikte çalışır.
  ===================================================== */
  const CW = 1080, CH = 1920, CM = 72;
  function newCard(bg) { const cv = el("canvas"); cv.width = CW; cv.height = CH; const c = cv.getContext("2d"); c.fillStyle = bg; c.fillRect(0, 0, CW, CH); c.textBaseline = "alphabetic"; return { cv, c }; }
  function deco(c, S, color, alpha) {                      // güvenli alanın dışındaki üst/alt bantta temaya göre süs motifi
    const r = rng(hash(S.user.login || S.user.name || "x") + 11), m = SKIN.motif, bands = [46, 1672]; c.fillStyle = color;
    if (m === "checker") { const s = 52, cols = Math.floor(1000 / s); for (const y0 of bands) for (let row = 0; row < 4; row++) for (let col = 0; col < cols; col++) { if ((row + col) % 2) continue; c.globalAlpha = alpha * 1.1; rr(c, 40 + col * s, y0 + row * s, s, s, 0); } }
    else if (m === "dots") { const sp = 32, cols = Math.floor(1000 / sp); for (let bi = 0; bi < 2; bi++) for (let row = 0; row < 6; row++) for (let col = 0; col < cols; col++) { const rad = 13 * (1 - row / 6.5), yy = bi === 0 ? bands[0] + 14 + row * sp : bands[1] + 186 - row * sp, xx = 56 + col * sp + (row % 2 ? sp / 2 : 0); c.globalAlpha = alpha * 1.4; c.beginPath(); c.arc(xx, yy, rad, 0, 6.283); c.fill(); } }
    else if (m === "bars") { const bw = 26, gap = 10, n = Math.floor(1000 / (bw + gap)); for (let bi = 0; bi < 2; bi++) for (let i = 0; i < n; i++) { const hh = 36 + r() * 150; c.globalAlpha = alpha * (0.8 + r() * 0.6); const x = 40 + i * (bw + gap); bi === 0 ? rr(c, x, 46, bw, hh, 8) : rr(c, x, 1872 - hh, bw, hh, 8); } }
    else if (m === "film") { const hw = 34, hh = 46, sp = 64, n = Math.floor(1000 / sp); for (const y0 of [60, 150, 1722, 1812]) for (let i = 0; i < n; i++) { c.globalAlpha = alpha * 1.3; rr(c, 52 + i * sp, y0, hw, hh, 8); } }
    else if (m === "stripes") { const sw = 34, sp = 78, sl = 70; for (const y0 of bands) for (let x = 20; x < 1100; x += sp) { c.globalAlpha = alpha * 1.2; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + sw, y0); c.lineTo(x + sw - sl, y0 + 200); c.lineTo(x - sl, y0 + 200); c.closePath(); c.fill(); } }
    else if (m === "code") { const T = ["{ }", "</>", "( )", "[ ]", "=>", "//", "&&", "#!", "0x", "++"]; c.font = '700 54px "JetBrains Mono",monospace'; c.textBaseline = "alphabetic"; for (const y0 of [112, 204, 1740, 1832]) for (let x = 44; x < 1040; x += 128) { c.globalAlpha = alpha * (1 + r() * 0.8); c.fillText(T[Math.floor(r() * T.length)], x, y0); } }
    else if (m === "bubbles") { for (const y0 of bands) for (let row = 0; row < 3; row++) { const right = (row + (y0 > 1000 ? 1 : 0)) % 2 === 1, w1 = 150 + r() * 280, h1 = 52, y = y0 + 12 + row * 68; c.globalAlpha = alpha * (0.9 + r() * 0.7); rr(c, right ? 1040 - w1 : 40, y, w1, h1, 26); if (r() < 0.6) { const w2 = 90 + r() * 150; c.globalAlpha = alpha * 0.8; rr(c, right ? 1040 - w1 - w2 - 18 : 40 + w1 + 18, y, w2, h1, 26); } } }
    else { const size = 38, gap = 12, cols = Math.floor((CW - 80 + gap) / (size + gap)); for (const y0 of bands) for (let row = 0; row < 4; row++) for (let col = 0; col < cols; col++) { const v = r(); if (v < 0.35) continue; c.globalAlpha = alpha * (0.4 + v * 0.8); rr(c, 40 + col * (size + gap), y0 + row * (size + gap), size, size, 9); } }
    c.globalAlpha = 1;
  }

  function wrapLines(c, text, maxW) {
    const words = text.split(" "), lines = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function fitFont(c, text, maxW, startPx, weight) {
    c.font = `${weight} ${startPx}px ${DISP}`; const w = c.measureText(text).width;
    return w > maxW ? Math.floor((startPx * maxW) / w) : startPx;
  }
  async function prepCards(S) {
    try { await Promise.all([document.fonts.load('900 100px "Anybody"'), document.fonts.load('700 30px "Hanken Grotesk"')]); } catch { /* yedek yazı tipi */ }
    if (S._av === undefined) {
      S._av = null;
      if (S.user.avatar) { try { const img = new Image(); img.crossOrigin = "anonymous"; img.src = S.user.avatar + (S.user.avatar.includes("?") ? "&" : "?") + "s=300"; await img.decode(); S._av = img; } catch { /* avatarsız devam */ } }
    }
  }
  function drawAvatar(c, S, cx, cy, r, fg) {
    if (S._av) { c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.clip(); c.drawImage(S._av, cx - r, cy - r, r * 2, r * 2); c.restore(); return; }
    c.fillStyle = "rgba(255,255,255,.22)"; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.fill();
    c.fillStyle = fg; stretch(c, "expanded"); c.font = `900 ${Math.round(r * 0.95)}px ${DISP}`; c.textAlign = "center"; c.fillText((S.user.name || S.user.login || "?").slice(0, 1).toUpperCase(), cx, cy + r * 0.33); c.textAlign = "left";
  }
  async function svgImg(svg, color) {
    const s = svg.replace(/currentColor/g, color).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" ');
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); await img.decode(); return img;
  }
  const hostText = () => location.host || "wrapped";
  function head(c, S, color) {
    c.fillStyle = color; stretch(c, "normal"); c.font = `800 40px ${SANS}`; c.fillText(S.brand || "Wrapped", CM, 328);
    c.textAlign = "right"; c.globalAlpha = 0.85; c.font = `600 36px ${SANS}`; c.fillText(S.user.handle || "", CW - CM, 328); c.globalAlpha = 1; c.textAlign = "left";
  }
  function foot(c, color) { c.fillStyle = color; c.globalAlpha = 0.7; stretch(c, "normal"); c.font = `600 26px ${SANS}`; c.fillText(hostText(), CM, 1604); c.globalAlpha = 1; }

  function defaultBlocks(S) {
    const v = V(S);
    return [[nf.format(S.total), v.noun, "open"], [String(S.best.len), "gün üst üste seri", "closed"], [nf.format(S.active), "aktif gün", "review"], [S.busy ? nf.format(S.busy.count) : "0", "tek günde zirve", "link"]];
  }

  /* ---- 1) Poster ---- */
  async function drawPoster(S) {
    await prepCards(S); const { cv, c } = newCard(PAL.merge); deco(c, S, FGC.merge, 0.16); head(c, S, FGC.merge);
    stretch(c, "expanded"); const yp = fitFont(c, String(S.year), CW - CM * 2, 230, 900); c.fillStyle = FGC.merge; c.font = `900 ${yp}px ${DISP}`; c.fillText(String(S.year), CM - 6, 362 + yp * 0.74);
    drawAvatar(c, S, CM + 48, 638, 48, FGC.merge);
    const nm = S.user.name || S.user.login; c.fillStyle = FGC.merge; stretch(c, "normal"); c.font = `800 50px ${SANS}`; c.fillText(nm.length > 24 ? nm.slice(0, 23) + "…" : nm, CM + 124, 640);
    let y = 716;
    if (S.hasCal) { y += drawHeat(c, S.days, { x: 36, y, w: CW - 72, gap: 5, minCols: 53, hi: S.best.len >= 4 ? [S.best.s, S.best.e] : null, dim: 0.5, colors: heatCols(FGC.merge) }) + 34; } else y += 20;
    const cfg = S.poster || {}, blocks = cfg.blocks || defaultBlocks(S);
    const bw = (CW - CM * 2 - 18) / 2, bh = 206, by0 = y;
    blocks.forEach(([val, lab, bgk, fgk], i) => {
      const bg = PAL[bgk] || bgk, fg = PAL[bgk] ? FGC[bgk] : fgk;
      const x = CM + (i % 2) * (bw + 18), by = by0 + Math.floor(i / 2) * (bh + 18);
      c.fillStyle = bg; rr(c, x, by, bw, bh, 36);
      c.fillStyle = fg; stretch(c, "expanded"); const fp = fitFont(c, val, bw - 64, 118, 900); c.font = `900 ${fp}px ${DISP}`; c.fillText(val, x + 32, by + 44 + fp * 0.78);
      stretch(c, "normal"); c.font = `700 32px ${SANS}`; c.fillText(lab, x + 34, by + bh - 28);
    });
    const sy = by0 + bh * 2 + 18 + 30, sh = 1566 - sy;
    c.fillStyle = PAL.review; rr(c, CM, sy, CW - CM * 2, sh, 40);
    c.fillStyle = FGC.review; stretch(c, "normal"); c.font = `600 30px ${SANS}`; c.fillText(V(S).personaLead1, CM + 40, sy + 56);
    stretch(c, "expanded"); const pk = S.persona.k, two = pk.includes(" ") && fitFont(c, pk, 600, 76, 900) < 58;
    if (!two) { const fs = fitFont(c, pk, 600, 76, 900); c.font = `900 ${fs}px ${DISP}`; c.fillText(pk, CM + 38, sy + 56 + 12 + fs * 0.85); }
    else { const [a, b] = splitMid(pk).split("\n"), fs = Math.min(fitFont(c, a, 600, 64, 900), fitFont(c, b, 600, 64, 900)); c.font = `900 ${fs}px ${DISP}`; c.fillText(a, CM + 38, sy + 56 + 8 + fs * 0.85); c.fillText(b, CM + 38, sy + 56 + 8 + fs * 1.85); }
    const chips = cfg.chips || [];
    if (cfg.waffle || chips.length) {
      const ws = Math.min(sh - 44, 160);
      if (cfg.waffle) drawWaffle(c, waffleCells(cfg.waffle), CW - CM - 40 - ws, sy + (sh - ws) / 2, ws, 4, 100, fgA("review", 0.18));
      const lim = CW - CM - 40 - (cfg.waffle ? ws + 10 : 0);
      if (!two) { let x = CM + 40; const cy = sy + sh - 74; stretch(c, "normal"); c.font = `700 28px ${SANS}`; chips.slice(0, 3).forEach((l) => { const w = c.measureText(l.name).width + 60; if (x + w > lim) return; c.fillStyle = fgA("review", 0.12); rr(c, x, cy, w, 52, 26); c.fillStyle = PAL[l.color] || l.color; c.beginPath(); c.arc(x + 28, cy + 26, 10, 0, 6.283); c.fill(); c.fillStyle = FGC.review; c.fillText(l.name, x + 48, cy + 36); x += w + 10; }); }
    }
    foot(c, FGC.merge); return cv;
  }

  /* ---- 2) Dev Kartı (FIFA tarzı) ---- */
  const RAR = {
    "Bronz": { g: ["#E0A06A", "#8A4B22"], ink: "#2A140A" },
    "Gümüş": { g: ["#EEF2F7", "#8F9BAA"], ink: "#1B2430" },
    "Altın": { g: ["#FFE066", "#C98A00"], ink: "#2B1D00" },
    "Efsane": { g: ["#7A4CFF", "#1F6FEB", "#E8453F", "#FFC933"], ink: "#FFFFFF" },
  };
  async function drawDev(S) {
    await prepCards(S); const { cv, c } = newCard(PAL.ink); deco(c, S, FGC.ink, 0.07); const R = RAR[S.rarity];
    const x = 130, y = 300, w = 820, h = 1262;
    const g = c.createLinearGradient(x, y, x + w, y + h); R.g.forEach((col, i) => g.addColorStop(i / (R.g.length - 1), col));
    c.fillStyle = g; rr(c, x, y, w, h, 64);
    const sh = c.createLinearGradient(x, y, x + w * 0.7, y + h * 0.5); sh.addColorStop(0, "rgba(255,255,255,.30)"); sh.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = sh; rr(c, x, y, w, h, 64);
    c.strokeStyle = rgba(hexRGB(R.ink), 0.28); c.lineWidth = 6; c.beginPath(); c.roundRect(x + 20, y + 20, w - 40, h - 40, 48); c.stroke();
    c.fillStyle = R.ink; stretch(c, "expanded"); c.font = `900 172px ${DISP}`; c.fillText(String(S.overall), x + 62, y + 232);
    stretch(c, "normal"); c.font = `800 36px ${SANS}`; c.fillText("GÜÇ", x + 66, y + 284);
    const pk = S.persona.k; c.font = `800 34px ${SANS}`; const pw = c.measureText(pk).width; if (pw > 232) c.font = `800 ${Math.floor((34 * 232) / pw)}px ${SANS}`; c.fillText(pk, x + 66, y + 336);
    try { const im = await svgImg(ICONS[S.persona.k] || ICONS["Yeni Başlayan"], R.ink); c.drawImage(im, x + w - 62 - 150, y + 56, 150, 150); } catch { /* simge yok */ }
    c.save(); c.beginPath(); c.arc(x + w / 2 + 70, y + 340, 176, 0, 6.283); c.fillStyle = rgba(hexRGB(R.ink), 0.16); c.fill(); c.restore();
    drawAvatar(c, S, x + w / 2 + 70, y + 340, 160, R.ink);
    const nm = S.user.name || S.user.login; c.fillStyle = R.ink; stretch(c, "expanded"); const nf2 = fitFont(c, nm, w - 120, 64, 900); c.font = `900 ${nf2}px ${DISP}`; c.textAlign = "center"; c.fillText(nm, x + w / 2, y + 640);
    stretch(c, "normal"); c.globalAlpha = 0.8; c.font = `600 34px ${SANS}`; c.fillText("@" + S.user.login, x + w / 2, y + 690); c.globalAlpha = 1;
    c.strokeStyle = rgba(hexRGB(R.ink), 0.3); c.lineWidth = 4; c.beginPath(); c.moveTo(x + 80, y + 730); c.lineTo(x + w - 80, y + 730); c.stroke();
    S.scores.forEach((a, i) => {
      const col = i % 2, row = Math.floor(i / 2), ax = x + 120 + col * 340, ay = y + 810 + row * 128;
      c.textAlign = "left"; stretch(c, "expanded"); c.font = `900 84px ${DISP}`; c.fillText(String(a.v), ax, ay);
      stretch(c, "normal"); c.font = `800 40px ${SANS}`; c.fillText(a.k, ax + 150, ay - 4);
    });
    c.textAlign = "center"; c.globalAlpha = 0.85; stretch(c, "normal"); c.font = `800 34px ${SANS}`; c.fillText(`${S.rarity} kart  ·  ${S.year}`, x + w / 2, y + h - 62); c.globalAlpha = 1; c.textAlign = "left";
    c.fillStyle = "#fff"; c.globalAlpha = 0.7; c.font = `600 26px ${SANS}`; c.fillText(hostText(), CM, 1604); c.globalAlpha = 1;
    return cv;
  }

  /* ---- 3) Kod Şehri ---- */
  async function drawSkyCard(S) {
    await prepCards(S); const { cv, c } = newCard(PAL.ink); deco(c, S, FGC.ink, 0.07); head(c, S, FGC.ink);
    stretch(c, "expanded"); c.fillStyle = FGC.ink; const t = `${S.year} ${V(S).skyCard}`, fs = fitFont(c, t, CW - CM * 2, 92, 900); c.font = `900 ${fs}px ${DISP}`; c.fillText(t, CM - 4, 420 + fs * 0.2);
    stretch(c, "normal"); c.globalAlpha = 0.8; c.font = `500 34px ${SANS}`; c.fillText(`Her bina bir gün, yükseklik o günkü ${V(S).noun} sayısı.`, CM, 486); c.globalAlpha = 1;
    const color = (tt, peak, zero) => { if (peak) return { top: "#FFE27A", left: "#E5B21A", right: "#B88A00" }; if (zero) return { top: "rgba(255,255,255,.12)", left: "rgba(255,255,255,.07)", right: "rgba(255,255,255,.04)" }; const b = ramp(tt); return { top: rgba(mixc(b, [255, 255, 255], 0.18)), left: rgba(mixc(b, [0, 0, 0], 0.22)), right: rgba(mixc(b, [0, 0, 0], 0.42)) }; };
    const used = drawSkyline(c, S, { x: 40, y: 540, w: 1000, color });
    const sy = 540 + used + 30, st = [[nf.format(S.total), V(S).noun], [nf.format(S.active), "aktif gün"], [S.busy ? nf.format(S.busy.count) : "0", "zirve günü"]];
    st.forEach(([a, b], i) => { const x = CM + i * 320; c.fillStyle = FGC.ink; stretch(c, "expanded"); const f2 = fitFont(c, a, 280, 76, 900); c.font = `900 ${f2}px ${DISP}`; c.fillText(a, x, Math.min(sy + 80, 1520)); stretch(c, "normal"); c.globalAlpha = 0.85; c.font = `600 32px ${SANS}`; c.fillText(b, x, Math.min(sy + 124, 1564)); c.globalAlpha = 1; });
    foot(c, FGC.ink); return cv;
  }

  /* ---- 4) Yorumlar ---- */
  async function drawRoastCard(S) {
    await prepCards(S); const { cv, c } = newCard(PAL.closed); deco(c, S, FGC.closed, 0.13); head(c, S, FGC.closed);
    stretch(c, "expanded"); c.fillStyle = FGC.closed; c.font = `900 84px ${DISP}`; c.fillText("Bir de bizden", CM - 4, 440);
    stretch(c, "normal"); c.font = `600 34px ${SANS}`; c.globalAlpha = 0.85; c.fillText("Verilerine bakarak, sevgiyle.", CM, 492); c.globalAlpha = 1;
    const cols = ["#FFFFFF", PAL.review, PAL.paper], rot = [-1.6, 1.3, -0.9]; let y = 540;
    c.font = `800 46px ${SANS}`;
    S.roasts.slice(0, 3).forEach((t, i) => {
      const lines = wrapLines(c, t, 760), h = 56 + lines.length * 60, x = CM + 12;
      c.save(); c.translate(x + 440, y + h / 2); c.rotate((rot[i] * Math.PI) / 180); c.translate(-440, -h / 2);
      c.shadowColor = "rgba(20,17,31,.35)"; c.shadowBlur = 24; c.shadowOffsetY = 10; c.fillStyle = cols[i]; rr(c, 0, 0, 880, h, 30); c.shadowColor = "transparent";
      c.fillStyle = PAL.ink; stretch(c, "normal"); c.font = `800 46px ${SANS}`; lines.forEach((ln, k) => c.fillText(ln, 40, 66 + k * 60)); c.restore();
      y += h + 34;
    });
    foot(c, FGC.closed); return cv;
  }

  /* ---- 5) Kelime posteri ---- */
  async function drawWordsCard(S) {
    await prepCards(S); const wc = S.wordsCard, { cv, c } = newCard(PAL.link); deco(c, S, FGC.link, 0.13); head(c, S, FGC.link);
    stretch(c, "normal"); c.fillStyle = FGC.link; c.font = `700 40px ${SANS}`; c.fillText(wc.title, CM, 416);
    const ws = wc.words.slice(0, 6), mx = ws[0].n; let y = 440;
    ws.forEach((w, i) => {
      stretch(c, "expanded"); const size = fitFont(c, w.w, CW - CM * 2, Math.max(70, Math.round(210 * Math.pow(w.n / mx, 0.75))), 900);
      c.fillStyle = i % 2 === 0 ? FGC.link : PAL.review; c.font = `900 ${size}px ${DISP}`; y += size * 0.86; c.fillText(w.w, CM - 4, y); y += size * 0.16;
    });
    stretch(c, "normal"); c.fillStyle = FGC.link; c.font = `600 34px ${SANS}`;
    let ly = Math.max(y + 56, 1380); wc.lines.forEach((t, i) => { c.globalAlpha = i === 0 ? 1 : 0.88; c.fillText(t, CM, Math.min(ly + i * 50, 1568)); });
    c.globalAlpha = 1; foot(c, FGC.link); return cv;
  }

  /* ---- Kartları sırayla üret, önbelleğe al ---- */
  function ensureCards(S) {
    if (S.duel) return ensureDuelCards(S);
    if (S._cardsP) return S._cardsP;
    S._cardsP = (async () => {
      const v = V(S), P = PLUG(S), defs = [["poster", "Poster", drawPoster, true], ["dev", v.devName || "Dev kartı", drawDev, !!S.scores], ["sky", v.skyName || "Kod şehri", drawSkyCard, S.hasCal && S.total > 0], ["roast", "Yorumlar", drawRoastCard, true], ["words", (S.wordsCard && S.wordsCard.name) || "Kelimeler", drawWordsCard, !!S.wordsCard]], out = [];
      if (P && P.extraCards) defs.push(...P.extraCards(S, KIT));
      for (const [id, name, fn, ok] of defs) {
        if (!ok) continue;
        try { const cv = await fn(S), blob = await new Promise((r) => cv.toBlob(r, "image/png")); out.push({ id, name, cv, blob, url: URL.createObjectURL(blob) }); }
        catch (e) { console.error("kart üretilemedi:", id, e); }
      }
      if (reelSupported()) out.push({ id: "reel", name: "Reels videosu", video: true });
      S.cards = out; return out;
    })();
    return S._cardsP;
  }
  async function exportBlob(card, fmt) {
    if (fmt === "story") return card.blob;
    const cv = el("canvas"); cv.width = 1080; cv.height = 1350; cv.getContext("2d").drawImage(card.cv, 0, 285, 1080, 1350, 0, 0, 1080, 1350);
    return new Promise((r) => cv.toBlob(r, "image/png"));
  }
  function captionText(S) {
    if (S.duel) return `${S.year} ${S.brand} düellosu ⚔️\n${S.A.user.handle} ${S.sa} – ${S.sb} ${S.B.user.handle}\n${S.W ? "Kazanan: " + S.W.user.handle : "Berabere"}\n\nSen de rakibini seç: ${shareUrlFor(S)}\n\n${S.hashtags || "#Wrapped"} #Düello`;
    const P = PLUG(S); return P && P.caption ? P.caption(S, shareUrlFor(S)) : `${S.year} ${S.brand}'ım ✨\n${S.persona.k}\n\nSen de dene: ${shareUrlFor(S)}\n\n${S.hashtags || "#Wrapped"}`;
  }
  const shareUrlFor = (S) => `${location.protocol === "file:" ? location.href.split(/[?#]/)[0] : location.origin + location.pathname}?${new URLSearchParams(S.query || {}).toString()}`;

  /* =====================================================
     Paylaşım Stüdyosu (son kart)
  ===================================================== */
  const ST = { fmt: "story", i: 0, deck: null };
  function deckMove(d) { if (!ST.deck) return; const items = ST.deck.children; if (!items.length) return; ST.i = clamp(ST.i + d, 0, items.length - 1); items[ST.i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); updateDots(); }
  function updateDots() { const d = ST.deck && ST.deck.nextElementSibling; if (d && d.classList.contains("dots")) [...d.children].forEach((x, k) => x.classList.toggle("on", k === ST.i)); }
  function layoutDeck() {
    const deck = ST.deck; if (!deck || !deck.isConnected) return;
    const cap = deck.querySelector("figcaption"), capH = cap ? cap.offsetHeight + 10 : 30, h = Math.max(120, deck.clientHeight - capH), ratio = ST.fmt === "story" ? 9 / 16 : 4 / 5;
    deck.style.setProperty("--ih", h + "px"); deck.style.paddingInline = Math.max(0, (deck.clientWidth - h * ratio) / 2) + "px";
  }
  function layoutDev() {
    const h = document.querySelector(".dev-holder"), c = h && h.querySelector(".dev-card"); if (!c) return;
    const w = Math.min(h.clientWidth, h.clientHeight * 0.8); c.style.width = w + "px"; c.style.height = w / 0.8 + "px";
  }
  function studio(root, S) {
    ST.i = 0;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), canShare = !!(navigator.share && navigator.canShare);
    root.append(say("Paylaşmaya hazır."), say(ios ? "Karta uzun bas, Fotoğraflara Ekle de. Sonra Instagram'dan paylaş." : "Kartı seç, kaydet, Instagram'dan paylaş.", true));
    const deck = el("div", "deck"); deck.dataset.fmt = ST.fmt; ST.deck = deck; root.append(deck, el("div", "dots"));
    deck.append(el("p", "say sm", "Kartlar hazırlanıyor…"));
    const seg = el("div", "fmt-seg");
    [["story", "Hikâye 9:16"], ["post", "Gönderi 4:5"]].forEach(([k, t]) => {
      const b = el("button", null, t); b.type = "button"; b.setAttribute("aria-pressed", String(k === ST.fmt));
      b.onclick = () => { ST.fmt = k; deck.dataset.fmt = k; [...seg.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b))); layoutDeck(); const it = deck.children[ST.i]; if (it && it.scrollIntoView) it.scrollIntoView({ inline: "center", block: "nearest" }); };
      seg.append(b);
    });
    const cur = () => (S.cards || [])[ST.i], imgs = () => (S.cards || []).filter((c) => !c.video);
    const fname = (c) => (c.video ? `github-wrapped-${S.user.login}-${S.year}-reels.${(S.video && S.video.ext) || "mp4"}` : `github-wrapped-${S.user.login}-${S.year}-${c.id}-${ST.fmt}.png`);
    const fileOf = async (c) => (c.video ? new File([S.video.blob], fname(c), { type: S.video.mime }) : new File([await exportBlob(c, ST.fmt)], fname(c), { type: "image/png" }));
    async function save(c) { const b = c.video ? S.video.blob : await exportBlob(c, ST.fmt); const a = el("a"); a.href = URL.createObjectURL(b); a.download = fname(c); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
    async function shareFiles(cards) {
      const files = []; for (const c of cards) files.push(await fileOf(c));
      if (canShare && navigator.canShare({ files })) { try { await navigator.share({ files }); } catch { /* vazgeçildi */ } return; }
      for (const c of cards) { await save(c); await wait(350); } toast(cards.length > 1 ? "Kartlar indirildi" : "Dosya indirildi");
    }
    const needVideo = (c) => { if (c && c.video && !S.video) { toast("Önce videoyu oluştur, sekmeyi açık tut."); if (c.start && !c.busy) c.start(); return true; } return false; };
    const guard = (fn) => () => { if (!S.cards || !S.cards.length) { toast("Kartlar hazırlanıyor, bir saniye"); return; } if (needVideo(cur())) return; fn(); };
    const copyCap = async () => { try { await navigator.clipboard.writeText(captionText(S)); toast("Açıklama kopyalandı"); } catch { toast("Kopyalanamadı"); } };
    const mk = (t, cls, fn) => { const b = el("button", "btn" + (cls ? " " + cls : ""), t); b.type = "button"; b.onclick = fn; return b; };
    const ac = el("div", "actions"), r1 = el("div", "row2"), r2 = el("div", "row2");
    if (canShare) r1.append(mk("Bunu paylaş", "", guard(() => shareFiles([cur()]))), mk("Kaydet", "alt", guard(async () => { await save(cur()); toast("Dosya indirildi"); })));
    else r1.append(mk("Bunu indir", "", guard(async () => { await save(cur()); toast("Dosya indirildi"); })), mk("Tümünü indir", "alt", guard(() => shareFiles(imgs()))));
    r2.append(mk(canShare ? "Tüm kartlar" : "Açıklamayı kopyala", "alt", canShare ? guard(() => shareFiles(imgs())) : copyCap), mk(canShare ? "Açıklamayı kopyala" : "Baştan izle", "alt", canShare ? copyCap : () => go(0, { dir: -1 })));
    ac.append(seg, r1, r2);
    if (canShare) { const again = el("button", "linkbtn", "Baştan izle"); again.type = "button"; again.onclick = () => go(0, { dir: -1 }); ac.append(again); }
    root.append(ac);

    ensureCards(S).then((cards) => {
      if (!deck.isConnected) return;
      deck.textContent = ""; const dots = deck.nextElementSibling;
      cards.forEach((c, k) => {
        const f = el("figure", "deck-item");
        if (c.video) { const box = el("div", "vid-box"); c.box = box; c.start = () => runReel(S, c, box); idleReel(c, box, (cards[0] || {}).url); f.append(box); }
        else { const im = el("img"); im.src = c.url; im.alt = `${c.name} kartı`; im.draggable = false; f.append(im); }
        f.append(el("figcaption", "", c.name)); deck.append(f); dots.append(el("i", k === 0 ? "on" : ""));
      });
      layoutDeck();
    });
    let raf = 0;
    deck.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = deck.scrollLeft + deck.clientWidth / 2; let best = 0, bd = 1e9;
        [...deck.children].forEach((it, k) => { const d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = k; } });
        if (best !== ST.i) { ST.i = best; updateDots(); }
      });
    });
    after(layoutDeck);
  }

  /* =====================================================
     Düello: iki kullanıcıyı karşılaştır
  ===================================================== */
  function makeDuel(A, B) {
    const rounds = PLUG(A).duelRounds(A, B), sa = rounds.filter((r) => r.win === "a").length, sb = rounds.filter((r) => r.win === "b").length;
    let win = sa > sb ? "a" : sb > sa ? "b" : "t";
    if (win === "t") win = A.overall > B.overall ? "a" : B.overall > A.overall ? "b" : "t";
    const W = win === "a" ? A : win === "b" ? B : null, L = win === "a" ? B : win === "b" ? A : null, lines = [], low = (s) => s.toLocaleLowerCase("tr");
    if (W) {
      const mine = rounds.filter((r) => r.win === win).map((r) => ({ r, m: Math.max(r.a, r.b) / Math.max(1, Math.min(r.a, r.b)) })).sort((x, y) => y.m - x.m)[0];
      if (mine) lines.push(`${W.user.handle}, ${low(mine.r.label)} turunda rakibini açık ara geçti.`);
      const back = rounds.find((r) => r.win === (win === "a" ? "b" : "a"));
      if (back) lines.push(`Teselli: ${L.user.handle}, ${low(back.label)} turunu aldı.`);
    } else lines.push("Ortada kalmış iki geliştirici. Rövanş şart.");
    return { duel: true, A, B, rounds, sa, sb, win, W, L, lines, year: A.year, src: A.src, brand: A.brand, hashtags: A.hashtags, vocab: A.vocab, query: { ...A.query, v: B.query.u }, user: { login: `${A.user.login}-vs-${B.user.login}`, handle: `${A.user.handle} vs ${B.user.handle}` } };
  }

  /* ---- Düello hikâyesi ---- */
  function faceSlide(D, R, theme) {
    return { t: theme, dur: 6.5, r(root) {
      root.append(say(`${R.label} turu`));
      const wrap = el("div", "face"), mx = Math.max(R.a, R.b, 1);
      [["a", D.A], ["b", D.B]].forEach(([k, S]) => {
        const side = el("div", "face-side" + (R.win === k ? " win" : "")), n = big("0", 26);
        side.append(el("p", "say sm", S.user.handle), n);
        const bar = el("i", "face-bar"); bar.dataset.w = Math.max(Math.round((R[k] / mx) * 100), 3); side.append(bar);
        if (R.win === k) side.append(el("span", "face-tag", "Turu aldı"));
        wrap.append(side); countUp(n, R[k], R.fmt);
      });
      root.append(wrap);
      after(() => wrap.querySelectorAll(".face-bar").forEach((b) => { b.style.width = b.dataset.w + "%"; }));
    } };
  }
  function buildDuelSlides(D) {
    const L = [], pick = (id) => D.rounds.find((r) => r.id === id);
    ensureCards(D);
    L.push({ t: "t-merge", dur: 5.5, r(root) {
      root.append(say(`${D.year} düellosu`), el("div", "grow"));
      const row = el("div", "vs"), side = (S) => { const w = el("div", "vs-side"); w.append(avatarNode(S, "avatar vs-av"), el("p", "say", S.user.handle)); return w; };
      row.append(side(D.A), el("div", "vs-badge", "VS"), side(D.B));
      root.append(row, el("div", "grow"), say(`İki geliştirici, ${D.rounds.length} tur. Kazanan hikâyenin sonunda belli olacak.`, true));
    } });
    (PLUG(D.A).duelHighlights || ["total", "streak", "stars", "power"]).forEach((id, k) => { const R = pick(id); if (R) L.push(faceSlide(D, R, ["t-open", "t-closed", "t-review", "t-link"][k % 4])); });
    L.push({ t: "t-ink", dur: 9, r(root) {
      root.append(say("Skor tablosu"), big(`${D.sa} – ${D.sb}`, 30), el("div", "grow"));
      const tb = el("div", "tbl"), hd = el("div", "tbl-row tbl-hd");
      hd.append(el("span", "", D.A.user.handle), el("span", ""), el("span", "", D.B.user.handle)); tb.append(hd);
      D.rounds.forEach((R) => { const row = el("div", "tbl-row"); row.append(el("span", "tbl-v" + (R.win === "a" ? " w" : ""), R.fmt(R.a)), el("span", "tbl-l", R.label), el("span", "tbl-v" + (R.win === "b" ? " w" : ""), R.fmt(R.b))); tb.append(row); });
      root.append(tb, el("div", "grow"));
    } });
    L.push({ t: "t-review", dur: 8.5, r(root) {
      root.append(say(D.W ? "Kazanan" : "Sonuç"));
      if (D.W) { const av = avatarNode(D.W, "avatar"); root.append(av, big(D.W.user.handle, 16)); } else root.append(big("Berabere", 24));
      root.append(say(`${D.sa} – ${D.sb}`)); D.lines.forEach((t) => root.append(say(t, true))); root.append(el("div", "grow"));
      const won = D.rounds.filter((r) => r.win === D.win);
      if (D.W && won.length) { root.append(say("Kazandığı turlar", true)); const ch = el("div", "chips"); won.forEach((r) => ch.append(el("span", "chip", r.label))); root.append(ch); }
    } });
    if (D.A.scores && D.B.scores) L.push({ t: "t-merge", dur: 7, r(root) {
      root.append(say("Kartlar masada."), say(`${D.A.rarity} ve ${D.B.rarity} kart karşı karşıya. Güç: ${D.A.overall} ve ${D.B.overall}.`, true));
      const holder = el("div", "dev-holder"); root.append(holder); holder.append(el("p", "say sm", "Kartlar çiziliyor…"));
      ensureCards(D).then((cards) => { const d = cards.find((c) => c.id === "devs"); if (!d || !holder.isConnected) return; const w = el("div", "dev-card"), im = el("img", "dev-img"); im.src = d.url; im.alt = "Dev kartları"; im.draggable = false; w.append(im); holder.textContent = ""; holder.append(w); layoutDev(); });
    } });
    L.push({ t: "t-ink", last: true, r(root) { studio(root, D); } });
    return L;
  }

  /* ---- Düello kartları ---- */
  async function drawDuelPoster(D) {
    const { A, B } = D; await prepCards(A); await prepCards(B);
    const { cv, c } = newCard(PAL.merge); deco(c, A, FGC.merge, 0.16);
    c.fillStyle = FGC.merge; stretch(c, "normal"); c.font = `800 40px ${SANS}`; c.fillText(`${D.brand} düellosu`, CM, 328);
    c.textAlign = "right"; c.globalAlpha = 0.85; c.font = `600 36px ${SANS}`; c.fillText(String(D.year), CW - CM, 328); c.globalAlpha = 1; c.textAlign = "left";
    const cy = 510;
    [[A, 270], [B, 810]].forEach(([S, cx]) => {
      if (D.W === S) { c.strokeStyle = PAL.review; c.lineWidth = 12; c.beginPath(); c.arc(cx, cy, 124, 0, 6.283); c.stroke(); }
      drawAvatar(c, S, cx, cy, 108, FGC.merge);
      const t = S.user.handle; c.fillStyle = FGC.merge; stretch(c, "normal"); c.textAlign = "center"; c.font = `800 44px ${SANS}`;
      const w = c.measureText(t).width; if (w > 440) c.font = `800 ${Math.floor((44 * 440) / w)}px ${SANS}`; c.fillText(t, cx, cy + 190); c.textAlign = "left";
    });
    c.fillStyle = PAL.review; c.beginPath(); c.arc(540, cy, 64, 0, 6.283); c.fill();
    c.fillStyle = FGC.review; stretch(c, "expanded"); c.font = `900 54px ${DISP}`; c.textAlign = "center"; c.fillText("VS", 540, cy + 19);
    c.fillStyle = FGC.merge; const sc = `${D.sa} – ${D.sb}`, sf = fitFont(c, sc, 700, 170, 900); c.font = `900 ${sf}px ${DISP}`; c.fillText(sc, 540, 905);
    const rowH = D.rounds.length > 7 ? 62 : 70, y0 = 960;
    D.rounds.forEach((R, i) => {
      const y = y0 + i * rowH; c.strokeStyle = fgA("merge", 0.2); c.lineWidth = 2; c.beginPath(); c.moveTo(CM, y); c.lineTo(CW - CM, y); c.stroke();
      stretch(c, "normal"); c.textAlign = "center"; c.fillStyle = FGC.merge; c.globalAlpha = 0.92; c.font = `700 29px ${SANS}`; c.fillText(R.label, 540, y + rowH / 2 + 10); c.globalAlpha = 1;
      [["a", 190], ["b", 890]].forEach(([k, x]) => {
        const v = R.fmt(R[k]); c.font = `800 32px ${SANS}`;
        if (R.win === k) { const w = Math.max(150, c.measureText(v).width + 44); c.fillStyle = PAL.review; rr(c, x - w / 2, y + 8, w, rowH - 16, (rowH - 16) / 2); c.fillStyle = FGC.review; } else c.fillStyle = fgA("merge", 0.88);
        c.fillText(v, x, y + rowH / 2 + 11);
      });
    });
    c.textAlign = "left"; const by = y0 + D.rounds.length * rowH + 22;
    c.fillStyle = PAL.review; rr(c, CM, by, CW - CM * 2, 74, 37); c.fillStyle = FGC.review; stretch(c, "normal"); c.textAlign = "center"; c.font = `800 38px ${SANS}`;
    c.fillText(D.W ? `Kazanan: ${D.W.user.handle}` : "Berabere, rövanş şart", 540, by + 49); c.textAlign = "left";
    foot(c, FGC.merge); return cv;
  }
  async function drawDuelDev(D) {
    const { A, B } = D, ca = await drawDev(A), cb = await drawDev(B); const { cv, c } = newCard(PAL.ink); deco(c, A, FGC.ink, 0.07);
    c.fillStyle = FGC.ink; stretch(c, "normal"); c.font = `800 40px ${SANS}`; c.fillText(`${D.brand} düellosu`, CM, 328);
    stretch(c, "expanded"); c.font = `900 78px ${DISP}`; c.fillText("Dev kartları", CM - 3, 428);
    const w = 456, h = Math.round((w * 1262) / 820), y = 480, xs = [72, 552];
    [[ca, A, xs[0]], [cb, B, xs[1]]].forEach(([cnv, S, x]) => {
      if (D.W === S) { c.strokeStyle = PAL.review; c.lineWidth = 8; c.beginPath(); c.roundRect(x - 9, y - 9, w + 18, h + 18, 40); c.stroke(); }
      c.drawImage(cnv, 130, 300, 820, 1262, x, y, w, h);
      c.textAlign = "center"; c.fillStyle = FGC.ink; stretch(c, "normal"); c.font = `800 34px ${SANS}`; const t = S.user.handle, tw = c.measureText(t).width; if (tw > w) c.font = `800 ${Math.floor((34 * w) / tw)}px ${SANS}`;
      c.fillText(t, x + w / 2, y + h + 56); c.globalAlpha = 0.85; c.font = `600 30px ${SANS}`; c.fillText(`${S.overall} güç, ${S.rarity}`, x + w / 2, y + h + 100); c.globalAlpha = 1; c.textAlign = "left";
    });
    c.fillStyle = PAL.review; c.beginPath(); c.arc(540, y + h / 2, 46, 0, 6.283); c.fill(); c.fillStyle = FGC.review; stretch(c, "expanded"); c.font = `900 40px ${DISP}`; c.textAlign = "center"; c.fillText("VS", 540, y + h / 2 + 14); c.textAlign = "left";
    c.fillStyle = FGC.ink; stretch(c, "normal"); c.font = `700 34px ${SANS}`; let ly = y + h + 168;
    D.lines.slice(0, 2).forEach((t) => wrapLines(c, t, CW - CM * 2).slice(0, 2).forEach((ln) => { if (ly < 1566) c.fillText(ln, CM, ly); ly += 46; }));
    foot(c, FGC.ink); return cv;
  }
  function ensureDuelCards(D) {
    if (D._cardsP) return D._cardsP;
    D._cardsP = (async () => {
      const defs = [["duel", "Düello", () => drawDuelPoster(D)], ["devs", "Dev kartları", () => drawDuelDev(D), !!(D.A.scores && D.B.scores)], ["pa", D.A.user.handle, () => drawPoster(D.A)], ["pb", D.B.user.handle, () => drawPoster(D.B)]], out = [];
      for (const [id, name, fn, ok] of defs) { if (ok === false) continue; try { const cv = await fn(), blob = await new Promise((r) => cv.toBlob(r, "image/png")); out.push({ id, name, cv, blob, url: URL.createObjectURL(blob) }); } catch (e) { console.error("kart üretilemedi:", id, e); } }
      D.cards = out; return out;
    })();
    return D._cardsP;
  }

  /* =====================================================
     Reels videosu: animasyonlu sahneler canvas'a çizilir ve MediaRecorder ile kaydedilir
  ===================================================== */
  const eo = (t) => 1 - (1 - t) ** 3, eb = (t) => { const a = 1.70158, b = a + 1; return 1 + b * (t - 1) ** 3 + a * (t - 1) ** 2; }, c01 = (t) => clamp(t, 0, 1);
  function reelMime(audio) {
    if (typeof MediaRecorder === "undefined") return null;
    const A = audio ? [",mp4a.40.2", ",opus"] : ["", ""];
    return [`video/mp4;codecs=avc1.640028${A[0]}`, `video/mp4;codecs=avc1${A[0]}`, "video/mp4", `video/webm;codecs=vp9${A[1]}`, `video/webm;codecs=vp8${A[1]}`, "video/webm"].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || null;
  }
  const reelSupported = () => !!(reelMime(false) && HTMLCanvasElement.prototype.captureStream);
  let REEL_FG = "#fff", REEL_T = 0, TX_I = 0;
  function tx(c, t, x, y, o = {}) {
    c.save(); stretch(c, o.stretch || "normal"); c.font = `${o.w || 700} ${o.s || 40}px ${o.f === "d" ? DISP : SANS}`;
    c.fillStyle = o.c || REEL_FG; c.textAlign = o.a || "left"; c.globalAlpha = o.al == null ? 1 : o.al;
    const k = HOOKS.reelEnter && !o.noEnter ? HOOKS.reelEnter(REEL_T, TX_I++) : null;
    if (k) {
      c.globalAlpha *= k.a; c.translate(k.dx || 0, k.dy || 0);
      if (k.s !== 1 || k.r || k.sk) { c.translate(x, y); if (k.sk) c.transform(1, 0, k.sk, 1, 0, 0); c.scale(k.s, k.s); c.rotate(k.r || 0); c.translate(-x, -y); }
      if (k.blur && "filter" in c) c.filter = `blur(${k.blur}px)`;
      if (k.clip != null && k.clip < 1) { const w = c.measureText(t).width, lx = c.textAlign === "center" ? x - w / 2 : c.textAlign === "right" ? x - w : x; c.beginPath(); c.rect(lx - 6, y - (o.s || 40) * 1.15, (w + 12) * k.clip, (o.s || 40) * 1.5); c.clip(); }
    }
    c.fillText(t, x, y); c.restore();
  }
  function txFit(c, t, x, y, maxW, start, o = {}) { stretch(c, "expanded"); const s = fitFont(c, t, maxW, start, 900); tx(c, o.show == null ? t : o.show, x, y, { ...o, f: "d", w: 900, s, stretch: "expanded" }); return s; }
  function reelWipe(c, color, q) { drawWipe(c, 1080, 1920, color, q, 1, SKIN.wipe); }
  function drawStreakCtx(c, n, x, y, w, maxH, lit, color, dim) {
    const cols = n <= 8 ? n : n <= 24 ? 8 : n <= 48 ? 12 : n <= 120 ? 20 : 30, rows = Math.ceil(n / cols), gap = Math.round(w * (cols > 12 ? 0.006 : 0.014));
    let cell = Math.min((w - gap * (cols - 1)) / cols, 170); cell = Math.min(cell, (maxH - gap * (rows - 1)) / rows);
    const ox = x + (w - (cell * cols + gap * (cols - 1))) / 2;
    for (let i = 0; i < n; i++) { c.fillStyle = i < lit ? color : dim; rr(c, ox + (i % cols) * (cell + gap), y + Math.floor(i / cols) * (cell + gap), cell, cell, cell * 0.2); }
  }

  function reelScenes(S, devCv, icon) {
    const vo = V(S), sc = [];
    sc.push({ bg: PAL.merge, fg: FGC.merge, dur: 2.4, draw(c, p) {
      deco(c, S, FGC.merge, 0.16);
      const e = eb(c01(p / 0.3)); c.save(); c.translate(540, 640); c.scale(e, e); drawAvatar(c, S, 0, 0, 170, FGC.merge); c.restore();
      const nm = S.user.name || S.user.login, a1 = eo(c01((p - 0.15) / 0.25));
      tx(c, nm.length > 22 ? nm.slice(0, 21) + "…" : nm, 540, 940, { a: "center", w: 800, s: 62, al: a1 }); tx(c, S.user.handle, 540, 1004, { a: "center", w: 600, s: 44, al: a1 * 0.9 });
      const ye = eo(c01((p - 0.3) / 0.35)); txFit(c, String(S.year), 540, 1250 + (1 - ye) * 80, 936, 300, { a: "center", al: ye });
      tx(c, vo.introTail1, 540, 1380, { a: "center", w: 700, s: 54, al: ye });
    } });
    if (S.hasCal && S.total > 0) sc.push({ bg: PAL.open, fg: FGC.open, dur: 3.4, draw(c, p) {
      deco(c, S, FGC.open, 0.14); tx(c, vo.totalLead, 540, 440, { a: "center", s: 56 });
      const fin = nf.format(S.total), v = nf.format(Math.round(S.total * eo(c01(p / 0.55))));
      stretch(c, "expanded"); const fs = fitFont(c, fin, 936, 300, 900); tx(c, v, 540, 730, { f: "d", w: 900, s: fs, a: "center", stretch: "expanded" });
      tx(c, `${vo.noun} ${vo.doVerb1}`, 540, 830, { a: "center", s: 60 });
      drawHeat(c, S.days, { x: 72, y: 940, w: 936, gap: 8, bands: 2, minCols: 53, upto: eo(c01((p - 0.05) / 0.8)), colors: heatCols(FGC.open) });
    } });
    if (S.hasCal && S.best.len >= 2) sc.push({ bg: PAL.closed, fg: FGC.closed, dur: 3, draw(c, p) {
      deco(c, S, FGC.closed, 0.13); tx(c, vo.streakLead1, 540, 440, { a: "center", c: FGC.closed, s: 56 });
      const n = S.best.len, v = Math.round(n * eo(c01(p / 0.6))); stretch(c, "expanded"); const fs = fitFont(c, String(n), 936, 300, 900);
      tx(c, String(v), 540, 730, { f: "d", w: 900, s: fs, a: "center", c: FGC.closed, stretch: "expanded" }); tx(c, vo.streakLine1 || vo.streakLine, 540, 830, { a: "center", c: FGC.closed, s: 60 });
      tx(c, `${fmtDay(S.days[S.best.s].date)} ile ${fmtDay(S.days[S.best.e].date)} arası`, 540, 910, { a: "center", c: FGC.closed, w: 700, s: 42, al: 0.9 });
      drawStreakCtx(c, n, 72, 990, 936, 520, Math.round(n * eo(c01((p - 0.1) / 0.75))), FGC.closed, fgA("closed", 0.18));
    } });
    if (S.hasCal && S.total > 0) sc.push({ bg: PAL.merge, fg: FGC.merge, dur: 3.6, draw(c, p) {
      deco(c, S, FGC.merge, 0.16); txFit(c, cap(vo.skyCard), 72, 450, 936, 100, {});
      tx(c, `Her bina bir gün, yükseklik o günkü ${vo.noun} sayısı.`, 72, 512, { w: 600, s: 38, al: 0.92 });
      const bgc = hexRGB(PAL.merge), f = hexRGB(FGC.merge), M = (a) => rgba(mixc(bgc, f, a));
      const color = (t, peak, zero) => peak ? { top: "#FFE27A", left: "#E5B21A", right: "#B88A00" } : zero ? { top: M(0.2), left: M(0.12), right: M(0.08) } : { top: M(0.62 + 0.38 * t), left: M(0.34 + 0.3 * t), right: M(0.18 + 0.2 * t) };
      drawSkyline(c, S, { x: 40, y: 560, w: 1000, p: eo(c01(p / 0.75)), color });
      if (S.busy) tx(c, `En yüksek bina ${fmtDay(S.busy.date)}: ${nf.format(S.busy.count)} ${vo.noun}`, 540, 1520, { a: "center", w: 800, s: 44, al: c01((p - 0.7) / 0.2) });
    } });
    const SCx = SCENES[S.src];
    (SCx && SCx.reel ? SCx.reel(S) : []).forEach((d, i) => {
      const slot = d.slot || ["open", "link", "closed"][i % 3];
      sc.push({ bg: PAL[slot], fg: FGC[slot], dur: d.reelDur || 4.6, draw(c, p, lt) {
        deco(c, S, FGC[slot], 0.14); tx(c, d.lead, 540, 400, { a: "center", s: 56 });
        if (d.big) { const f = d.big.f || nf.format, fin = d.big.text != null ? d.big.text : f(d.big.v), txt = d.big.text != null ? fin : f(Math.round(d.big.v * eo(c01(lt / 1.4)))); stretch(c, "expanded"); const fs = fitFont(c, fin, 920, 220, 900); tx(c, txt, 540, 640, { f: "d", w: 900, s: fs, a: "center", stretch: "expanded" }); }
        stageDraw(c, 60, d.big ? 700 : 520, 960, d.big ? 800 : 940, lt, d);
      } });
    });
    sc.push({ bg: PAL.review, fg: FGC.review, dur: 2.8, draw(c, p) {
      deco(c, S, FGC.review, 0.12); tx(c, vo.personaLead1, 540, 440, { a: "center", c: FGC.review, s: 54 });
      const e = eb(c01(p / 0.35)); if (icon) { c.save(); c.translate(540, 760); c.scale(e, e); c.drawImage(icon, -150, -150, 300, 300); c.restore(); }
      const a = eo(c01((p - 0.25) / 0.3)), parts = splitMid(S.persona.k).split("\n"); stretch(c, "expanded");
      const fs = Math.min(...parts.map((t) => fitFont(c, t, 936, 130, 900)));
      parts.forEach((t, i) => tx(c, t, 540, 1070 + i * fs * 1.0 + (1 - a) * 40, { f: "d", w: 900, s: fs, a: "center", c: FGC.review, al: a, stretch: "expanded" }));
      c.font = `700 44px ${SANS}`; const y0 = 1130 + (parts.length - 1) * fs + 90;
      wrapLines(c, S.persona.d, 860).slice(0, 2).forEach((ln, i) => tx(c, ln, 540, y0 + i * 58, { a: "center", c: FGC.review, s: 44, al: a }));
    } });
    if (devCv && S.scores) sc.push({ bg: PAL.ink, fg: FGC.ink, dur: 3.6, draw(c, p) {
      deco(c, S, FGC.ink, 0.07); tx(c, `${vo.cardLead1}: ${S.rarity}`, 540, 380, { a: "center", w: 800, s: 48 });
      const ch = 1100, cw = Math.round((ch * 820) / 1262), sx = Math.max(0.001, eo(c01(p / 0.3)));
      c.save(); c.translate(540, 430 + ch / 2); c.scale(sx, 1); c.drawImage(devCv, 130, 300, 820, 1262, -cw / 2, -ch / 2, cw, ch);
      if (S.rarity === "Altın" || S.rarity === "Efsane") {
        const q = c01((p - 0.45) / 0.35);
        if (q > 0 && q < 1) { c.beginPath(); c.roundRect(-cw / 2, -ch / 2, cw, ch, 60); c.clip(); const gx = -cw + q * cw * 2.2, g = c.createLinearGradient(gx, -ch / 2, gx + cw * 0.5, ch / 2); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(-cw / 2, -ch / 2, cw, ch); }
      }
      c.restore();
    } });
    sc.push({ bg: PAL.merge, fg: FGC.merge, dur: 2.6, draw(c, p) {
      deco(c, S, FGC.merge, 0.16); const a = eo(c01(p / 0.4));
      tx(c, `${S.brand} ${S.year}`, 540, 700, { a: "center", w: 800, s: 52, al: a });
      txFit(c, "Sen de dene", 540, 900 + (1 - a) * 60, 936, 150, { a: "center", al: a });
      tx(c, hostText(), 540, 1010, { a: "center", w: 700, s: 52, al: a * 0.95 }); tx(c, S.user.handle, 540, 1084, { a: "center", w: 600, s: 44, al: a * 0.85 });
    } });
    return sc;
  }
  function stageDraw(c, x, y, w, h, lt, d) {
    c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    try { d.draw(c, w, h, lt + (d.reelOffset || 0), sceneCs(REEL_FG, "#000")); } catch (e) { console.error("video sahnesi", d.id, e); }
    c.restore();
  }
  function reelFrame(c, scenes, t) {
    let acc = 0, i = 0; for (; i < scenes.length - 1; i++) { if (t < acc + scenes[i].dur) break; acc += scenes[i].dur; }
    const s = scenes[i], lt = Math.max(0, t - acc), p = c01(lt / s.dur);
    REEL_FG = s.fg || "#fff"; REEL_T = lt; TX_I = 0; c.save(); c.fillStyle = s.bg; c.fillRect(0, 0, 1080, 1920); if (HOOKS.reelFx) HOOKS.reelFx(c, t, REEL_FG); c.textBaseline = "alphabetic"; s.draw(c, p, lt); c.restore();
    if (HOOKS.reelChrome) { c.save(); HOOKS.reelChrome(c, i, scenes.length, p, REEL_FG); c.restore(); }
    if (i > 0 && lt < 0.55) reelWipe(c, scenes[i - 1].bg, lt / 0.55);
  }
  async function makeReel(S, onProgress) {
    if (!reelSupported()) throw new Error("unsupported");
    await prepCards(S); const cards = await ensureCards(S), dev = cards.find((c) => c.id === "dev") || null;
    let icon = null; try { icon = await svgImg(ICONS[S.persona.k] || ICONS.default || "", FGC.review); } catch { /* simgesiz */ }
    if (HOOKS.reelInit) HOOKS.reelInit(1080, 1920); const scenes = reelScenes(S, dev ? dev.cv : null, icon), total = scenes.reduce((a, s) => a + s.dur, 0), cv = el("canvas"); cv.width = 1080; cv.height = 1920;
    const c = cv.getContext("2d"); reelFrame(c, scenes, 0);
    let aud = null; const wantAudio = (() => { try { return localStorage.getItem("wf-reel-audio") !== "0"; } catch { return true; } })();
    if (wantAudio && HOOKS.audioTrack) { try { aud = await HOOKS.audioTrack(total); } catch (e) { console.warn("müzik eklenemedi", e); } }
    const mime = reelMime(!!aud), stream = cv.captureStream(30); if (aud) stream.addTrack(aud.track);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000 }), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    rec.start(500); if (aud) aud.start();
    await new Promise((res) => {
      const t0 = performance.now();
      (function f() { const t = (performance.now() - t0) / 1000; if (t >= total) { reelFrame(c, scenes, total - 0.01); onProgress(1); res(); return; } reelFrame(c, scenes, t); onProgress(t / total); requestAnimationFrame(f); })();
    });
    await wait(350); rec.stop(); await stopped; if (aud) aud.stop();
    const type = (rec.mimeType || mime || "video/webm").split(";")[0], res = { blob: new Blob(chunks, { type }), mime: type, ext: type.includes("mp4") ? "mp4" : "webm", seconds: total, audio: !!aud };
    window.Wrapped.lastReel = res; return res;
  }

  /* ---- Stüdyodaki video kartı ---- */
  function idleReel(c, box, poster) {
    box.textContent = "";
    const im = el("img"); im.src = poster; im.alt = ""; im.draggable = false;
    const go = el("button", "vid-go"); go.type = "button";
    go.append(el("span", "vid-play"), el("b", "", "Reels videosu"), el("small", "", "Yaklaşık 25 saniye"));
    go.onclick = () => c.start(); box.append(im, go);
    if (HOOKS.audioTrack) {
      const lab = el("label", "vid-aud"), cb = el("input"); cb.type = "checkbox"; try { cb.checked = localStorage.getItem("wf-reel-audio") !== "0"; } catch { cb.checked = true; }
      cb.onchange = () => { try { localStorage.setItem("wf-reel-audio", cb.checked ? "1" : "0"); } catch { /* özel pencere */ } };
      lab.append(cb, el("span", "", "Lofi müzik ekle (telifsiz)")); box.append(lab);
    }
  }
  async function runReel(S, c, box) {
    if (c.busy) return; c.busy = true;
    box.textContent = ""; const wrap = el("div", "vid-busy"), bar = el("i"), txt = el("b", "", "Video hazırlanıyor"), sub = el("small", "", "Sekmeyi açık tut, yaklaşık 25 saniye sürer");
    const track = el("div", "vid-bar"); track.append(bar); wrap.append(txt, track, sub); box.append(wrap);
    try {
      const r = await makeReel(S, (q) => { bar.style.width = Math.round(q * 100) + "%"; });
      S.video = r; box.textContent = "";
      const v = el("video"); v.src = URL.createObjectURL(r.blob); v.controls = true; v.playsInline = true; v.loop = true; v.muted = true; v.autoplay = true; box.append(v);
      toast(r.ext === "webm" ? "Video hazır. Bu tarayıcı WebM üretti, Instagram bazı cihazlarda kabul etmeyebilir. MP4 için Chrome ya da Safari dene." : "Video hazır");
    } catch (e) { console.error(e); box.textContent = ""; c.busy = false; toast("Video oluşturulamadı. Chrome veya Safari'de tekrar dene."); idleReel(c, box, (S.cards[0] || {}).url); return; }
    c.busy = false;
  }


  /* =====================================================
     Orkestratör: eklentiyi çalıştır, hikâyeyi kur, düelloyu birleştir
  ===================================================== */
  function show(which) { for (const k of ["landing", "loading", "story"]) $(k).hidden = k !== which; if (which === "landing") { applyTheme(LANDING); heroHeat(); } }
  function showErr(msg) { const e = $("err"); if (!e) return; e.textContent = msg || ""; e.hidden = !msg; }
  function baseErr(e, who) {
    switch (e.code) {
      case "ratelimit": return `İstek sınırına ulaşıldı.${e.extra ? ` ${new Date(e.extra).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} sonra tekrar dene` : " Biraz sonra tekrar dene"}.`;
      case "network": return "Veri kaynağına ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
      case "notfound": return `"${who}" bulunamadı.`;
      case "empty": return `${who ? "@" + who + " için " : ""}bu yıl için gösterilecek veri bulunamadı. Başka bir yıl dene.`;
      case "nodemo": return "Bu derlemede örnek veri yok (örnek veri yalnızca geliştirme derlemesindedir).";
      case "badfile": return "Bu dosya okunamadı. Doğru dosyayı seçtiğinden emin ol.";
      default: return "Bir şey ters gitti. Biraz sonra tekrar dene.";
    }
  }
  const STATE = { slides: [], lastRun: null };
  function finalize(P, W, input, year, raw) {
    W.src = P.id; W.brand = P.brand || P.name; W.hashtags = P.hashtags; W.year = W.year || year; W.partial = W.year === THIS_YEAR;
    W.vocab = { ...(P.vocab || {}), ...(W.vocab || {}) };
    W.query = { s: P.id, ...(input.query || {}), y: W.year };
    return W;
  }
  async function run(o) {
    // o: {src, input, rival (input|null), year, demo, token}
    const P = PLUGINS[o.src]; if (!P) { showErr("Bu kaynak bulunamadı."); return; }
    showErr(""); show("loading"); loadAnim(true); await useTheme(P.theme);
    const step = (t) => { $("loadTxt").textContent = t; }, who = (inp) => (inp && (inp.label || inp.user)) || "";
    try {
      let rawA, rawB = null;
      if (o.demo) { const D = Wrapped.demos && Wrapped.demos[o.src]; if (!D) throw mkErr("nodemo"); step(o.rival ? "Örnek düello hazırlanıyor" : "Örnek veri hazırlanıyor"); await wait(700); rawA = D(o.year, 0, o.input); if (o.rival) rawB = D(o.year, 1, o.rival); }
      else {
        rawA = await P.load(o.input, { year: o.year, step: o.rival ? (t) => step(`${who(o.input)}: ${t}`) : step, token: o.token, options: o.options || {} });
        if (o.rival) { try { rawB = await P.load(o.rival, { year: o.year, step: (t) => step(`${who(o.rival)}: ${t}`), token: o.token, options: {} }); } catch (e) { e.who = who(o.rival); throw e; } }
      }
      const A = finalize(P, P.analyze(rawA, { year: o.year, options: o.options || {} }), o.input, o.year, rawA);
      const B = rawB ? finalize(P, P.analyze(rawB, { year: o.year, options: {} }), o.rival, o.year, rawB) : null;
      if (P.isEmpty && P.isEmpty(A)) throw mkErr("empty");
      if (B && P.isEmpty && P.isEmpty(B)) { const e = mkErr("empty"); e.who = who(o.rival); throw e; }
      step("Kartlar diziliyor"); await useTheme(P.theme);
      try { await Promise.race([Promise.all([document.fonts.load('900 100px "Anybody"'), document.fonts.load('700 20px "Hanken Grotesk"')]), wait(2500)]); } catch { /* yedek yazı tipi */ }
      await wait(200);
      STATE.W = A; const D = B ? makeDuel(A, B) : null; STATE.slides = D ? buildDuelSlides(D) : P.slides(A, KIT);
      STATE.slides.year = A.year; SLIDES = STATE.slides; STATE.lastRun = o;
      loadAnim(false); show("story"); buildBars(); if (HOOKS.setup) HOOKS.setup({ frame, slideEl, theme: P.theme, W: D || A, slides: STATE.slides }); fresh = true; go(0);
      if (!o.demo && P.persistUrl !== false) { try { history.replaceState(null, "", `?${new URLSearchParams(B ? { ...A.query, v: B.query.u } : A.query).toString()}`); } catch { /* file:// */ } }
    } catch (e) {
      console.error(e);
      loadAnim(false); show("landing"); showErr((P.errMsg && P.errMsg(e, e.who || who(o.input))) || baseErr(e, e.who || who(o.input))); const gb = $("goBtn"); if (gb) gb.disabled = false;
    }
  }
  function closeStory() { if (HOOKS.teardown) HOOKS.teardown(); try { history.replaceState(null, "", location.pathname); } catch { /* file:// */ } show("landing"); const gb = $("goBtn"); if (gb) gb.disabled = false; }
  $("closeBtn").addEventListener("click", closeStory);

  /* =====================================================
     Dışa aktarım: eklentilerin kullanacağı araç seti
  ===================================================== */
  const KIT = {
    stage, sceneSlide, sceneFor, scenes: SCENES, DISPf: () => DISP, SANSf: () => SANS,
    PAL, FGC, fgA, heatCols, applyTheme, useTheme, DEF_THEME,
    // genel
    $, el, clamp, nf, pad, wait, hash, rng, toast, mkErr, cap, THIS_YEAR, NOW, reduced, localISO, parseD, fmtDay, weekdayName, WD, WD_SHORT, MONTHS, suf3, pcAcc, pcLoc, splitMid,
    // analiz
    activity, scoreK, rarityOf, finishCard, ICONS,
    // slayt araçları
    SL, say, big, after, countUp, fillBox, avatarNode, TOK: () => TOK,
    gfx: { heatCanvas, streakGrid, spikeChart, clockChart, waffleCanvas, waffleCells, skylineCanvas, timelineCanvas, lineChart, rankBars, anim, gfx },
    // kart araçları
    cards: { newCard, deco, head, foot, wrapLines, fitFont, drawAvatar, svgImg, prepCards, rr, stretch, drawHeat, drawSkyline, drawWaffle, waffleCells, CW, CH, CM, DISP, SANS, hostText, ramp, mixc, rgba },
    V, show, showErr,
  };
  window.Wrapped = {
    kit: KIT, plugins: PLUGINS, hooks: HOOKS, scenes: SCENES, slides: () => STATE.slides, analysis: () => STATE.W, goto: (i) => go(i), run, closeStory, show, showErr,
    setLanding: async (t) => { LANDING = t || DEF_THEME; await useTheme(LANDING); },
    register(p) { PLUGINS[p.id] = p; if (p.icons) Object.assign(ICONS, p.icons); },
    list: () => Object.values(PLUGINS),
  };
})();
