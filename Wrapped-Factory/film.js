/* Film Wrapped eklentisi: Letterboxd dışa aktarımı (.zip ya da .csv) tamamen tarayıcıda işlenir */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { el, clamp, nf, pad, wait, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, SL, MONTHS } = K;
  const pct = (x) => Math.round(x * 100), avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const stars = (r) => "★".repeat(Math.floor(r)) + (r % 1 ? "½" : ""), fmt1 = (v) => v.toFixed(1).replace(".", ",");

  /* ---- CSV ve zip ---- */
  function parseCSV(text) {
    text = text.replace(/^\ufeff/, ""); const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
      else cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return []; const head = rows.shift().map((h) => h.trim());
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? "" : r[i]])));
  }
  async function zipCsvs(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw mkErr("badfile");
    const cnt = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
    for (let i = 0; i < cnt; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const comp = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true), name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      const m = /(^|\/)(diary|ratings|watched)\.csv$/i.exec(name); if (!m) continue;
      const nl2 = dv.getUint16(lho + 26, true), xl2 = dv.getUint16(lho + 28, true), st = lho + 30 + nl2 + xl2, data = u8.subarray(st, st + cs);
      let bytes; if (comp === 0) bytes = data; else if (comp === 8 && typeof DecompressionStream !== "undefined") bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); else continue;
      out[m[2].toLowerCase()] = new TextDecoder("utf-8").decode(bytes);
    }
    return out;
  }
  async function readFilms(files) {
    const t = {};
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) Object.assign(t, await zipCsvs(await f.arrayBuffer()));
      else { const m = /(diary|ratings|watched)/i.exec(f.name); if (m && /\.csv$/i.test(f.name)) t[m[1].toLowerCase()] = await f.text(); }
    }
    const ratings = {}; if (t.ratings) for (const r of parseCSV(t.ratings)) ratings[r["Letterboxd URI"]] = parseFloat(r.Rating) || 0;
    const rows = t.diary ? parseCSV(t.diary) : t.watched ? parseCSV(t.watched) : [], films = [];
    for (const r of rows) {
      const date = (r["Watched Date"] || r.Date || "").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      films.push({ date, name: r.Name || "?", year: +r.Year || null, rating: parseFloat(r.Rating) || ratings[r["Letterboxd URI"]] || 0, rewatch: /yes/i.test(r.Rewatch || ""), tags: (r.Tags || "").split(",").map((x) => x.trim()).filter(Boolean) });
    }
    return films;
  }

  /* ---- analiz ---- */
  function analyze(raw) {
    const year = raw.year, es = raw.films.filter((f) => +f.date.slice(0, 4) === year).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const W = { raw, year, films: es, user: { ...raw.user, handle: `${nf.format(es.length)} film` }, partial: year === THIS_YEAR, nFilms: es.length };
    const dc = {}; es.forEach((f) => { dc[f.date] = (dc[f.date] || 0) + 1; });
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31); for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: dc[iso] || 0 }); }
    activity(W, { days: es.length ? days : [], hourTimes: [] }); W.hours = null;
    const rated = es.filter((f) => f.rating > 0); W.rated = rated.length; W.avgRating = rated.length ? avg(rated.map((f) => f.rating)) : null;
    W.dist = Array(10).fill(0); rated.forEach((f) => { W.dist[Math.min(9, Math.max(0, Math.round(f.rating * 2) - 1))]++; }); W.modeRating = W.rated ? (W.dist.indexOf(Math.max(...W.dist)) + 1) / 2 : null;
    W.top = rated.slice().sort((a, b) => b.rating - a.rating || (a.date < b.date ? 1 : -1)).slice(0, 5);
    const ys = es.map((f) => f.year).filter(Boolean); W.avgYear = ys.length ? avg(ys) : null; W.oldest = es.filter((f) => f.year).sort((a, b) => a.year - b.year)[0] || null;
    const dec = {}; ys.forEach((y) => { const d = Math.floor(y / 10) * 10; dec[d] = (dec[d] || 0) + 1; }); W.decades = Object.entries(dec).map(([d, n]) => ({ d: +d, name: `${d}'ler`, n })).sort((a, b) => b.n - a.n); W.decadeCount = W.decades.length;
    W.oldShare = ys.length ? ys.filter((y) => y < 1990).length / ys.length : 0; W.newShare = ys.length ? ys.filter((y) => y >= year - 1).length / ys.length : 0;
    W.rewatch = es.filter((f) => f.rewatch).length; W.rewatchShare = W.rewatch / Math.max(es.length, 1); W.rewatched = es.filter((f) => f.rewatch).slice(0, 3);
    W.first = es[0] || null; W.last = es[es.length - 1] || null;
    const o = [], wk = W.weekendShare || 0;
    if (W.oldShare >= 0.3) o.push({ k: "Klasik Avcısı", w: W.oldShare / 0.3, d: "Eski kopyalar, siyah beyaz kareler: tam senlik.", why: `Filmlerinin ${pcAcc(pct(W.oldShare))} 1990 öncesinden` });
    if (W.newShare >= 0.4) o.push({ k: "Vizyon Takipçisi", w: W.newShare / 0.4, d: "Yeni çıkan filmi ilk haftada izliyorsun.", why: `Filmlerinin ${pcAcc(pct(W.newShare))} son iki yıldan` });
    if (W.avgRating != null && W.avgRating >= 4 && W.rated >= 15) o.push({ k: "Cömert Puancı", w: W.avgRating / 4, d: "Her filmde seveceğin bir şey buluyorsun.", why: `Ortalama puan ${fmt1(W.avgRating)}` });
    if (W.avgRating != null && W.avgRating <= 2.8 && W.rated >= 15) o.push({ k: "Sert Eleştirmen", w: 2.8 / W.avgRating, d: "Çıtan çok yüksek, perdeden güzel film kaçmıyor ama.", why: `Ortalama puan ${fmt1(W.avgRating)}` });
    if (W.rewatchShare >= 0.15) o.push({ k: "Tekrar İzleyen", w: W.rewatchShare / 0.15, d: "Sevdiğin filmi tekrar tekrar izlemekten çekinmiyorsun.", why: `${W.rewatch} yeniden izleme` });
    if ((W.busy && W.busy.count >= 4) || es.length >= 150) o.push({ k: "Film Maratoncusu", w: Math.max((W.busy ? W.busy.count : 0) / 4, es.length / 150), d: "Tek akşamda birden fazla film senin için normal.", why: W.busy ? `Tek günde ${W.busy.count} film` : `${es.length} film` });
    if (wk >= 0.5) o.push({ k: "Hafta Sonu Sinemacısı", w: wk / 0.5, d: "Koltuk ve film hafta sonunun vazgeçilmezi.", why: `Filmlerinin ${pcAcc(pct(wk))} hafta sonu` });
    if (W.decadeCount >= 6) o.push({ k: "Dönem Gezgini", w: W.decadeCount / 6, d: "Her dönemden bir film izliyorsun.", why: `${W.decadeCount} farklı on yıldan film` });
    o.sort((a, b) => b.w - a.w); W.persona = o[0] || { k: "Sinema Gezgini", d: "Perdeden perdeye dolaşan meraklı bir seyirci.", why: "Dengeli bir film listesi" }; W.personaWhy = o.slice(0, 3).map((x) => x.why);
    const R = [], ad = (w, tag, t) => R.push({ w, tag, t });
    if (es.length >= 150) ad(es.length / 150, "sayi", `${nf.format(es.length)} film izledin. Yılın neredeyse her günü sinemaydın.`);
    if (W.busy && W.busy.count >= 4) ad(W.busy.count / 4, "maraton", `${fmtDay(W.busy.date)} günü tek günde ${W.busy.count} film. Ertesi gün işe gittin mi?`);
    if (W.avgRating != null && W.avgRating >= 4.1) ad(1.5, "puan", `Ortalama puanın ${fmt1(W.avgRating)}. Ya çok iyi seçiyorsun ya da çok kolay seviyorsun.`);
    if (W.avgRating != null && W.avgRating <= 2.7) ad(1.5, "puan", `Ortalama puanın ${fmt1(W.avgRating)}. Hiçbir film seni memnun etmiyor mu?`);
    if (W.rewatchShare >= 0.15) ad(1.4, "tekrar", `${W.rewatch} filmi yeniden izledin. Sürprizli son kalmamış mı?`);
    if (W.oldShare >= 0.4) ad(1.3, "klasik", `Filmlerinin ${pcAcc(pct(W.oldShare))} 1990'dan önce. Müzede gibisin.`);
    if (W.dist[9] / Math.max(W.rated, 1) >= 0.25) ad(1.2, "bes", `Puanlarının ${pcAcc(pct(W.dist[9] / W.rated))} tam 5 yıldız. Biraz cimri olmayı dene.`);
    if (W.gap && W.gap.len >= 20) ad(W.gap.len / 20, "ara", `${W.gap.len} gün hiç film izlemedin. Perdeyi mi özledin?`);
    R.sort((a, b) => b.w - a.w); const out = [], tg = new Set(); for (const x of R) { if (out.length >= 3) break; if (!tg.has(x.tag)) { tg.add(x.tag); out.push(x.t); } }
    for (const f of ["Film günlüğün dengeli bir zevk gösteriyor. Tebrikler, bu nadir.", "Bu yıl koltuğun seni çok özledi.", "Jenerik bitmeden kalkmayanlardansın, belli."]) { if (out.length >= 3) break; out.push(f); }
    W.roasts = out;
    finishCard(W, [["İZL", scoreK(es.length, 120)], ["BEG", W.avgRating == null ? 60 : 35 + 64 * clamp((W.avgRating - 2) / 2.5, 0, 1)], ["KLS", W.avgYear ? 35 + 64 * clamp((year - W.avgYear) / 40, 0, 1) : 50], ["ÇEŞ", scoreK(W.decadeCount, 5)], ["TKR", 35 + 64 * clamp(W.rewatchShare / 0.25, 0, 1)], ["İST", 35 + 64 * clamp((W.active / Math.max(W.elapsed, 1)) / 0.5, 0, 1)]]);
    W.poster = { blocks: [[nf.format(es.length), "film", "open"], [W.avgRating == null ? "—" : fmt1(W.avgRating), "ortalama puan", "closed"], [String(W.rewatch), "yeniden izleme", "review"], [String(W.best.len), "gün üst üste film", "link"]], chips: W.decades.slice(0, 3).map((d, i) => ({ name: d.name, color: ["review", "open", "link"][i] })), waffle: W.decades.slice(0, 6).map((d, i) => ({ pct: (d.n / Math.max(ys.length, 1)) * 100, color: ["review", "open", "link", "closed", "#B58CFF", "#7FD962"][i] })) };
    if (W.top.length >= 3) W.wordsCard = { name: "En iyiler", title: "En yüksek puan verdiklerin", words: W.top.map((f) => ({ w: f.name, n: Math.round(f.rating * 20) })), lines: [`Zirvede: ${W.top[0].name} (${stars(W.top[0].rating)}).`, `${nf.format(W.rated)} filme puan verdin.`] };
    return W;
  }

  /* ---- slaytlar ---- */
  const ratingSlide = (W) => ({ t: "t-link", r(root) {
    const n = big("0", 46), mx = Math.max(...W.dist, 1), lab = ["½", "1", "1½", "2", "2½", "3", "3½", "4", "4½", "5"];
    root.append(say("Ortalama puanın"), n, say("5 üzerinden."), say(`${nf.format(W.rated)} filme puan verdin. En çok verdiğin puan: ${stars(W.modeRating)}.`, true), el("div", "grow"));
    const w = el("div", "wk"); w.style.gridTemplateColumns = "repeat(10,minmax(0,1fr))"; W.dist.forEach((v, i) => { const c = el("div"), b = el("i", i + 1 === W.modeRating * 2 ? "top" : ""); b.dataset.h = Math.max(Math.round((v / mx) * 100), 1); c.append(b, el("span", "", lab[i])); w.append(c); });
    root.append(w); after(() => w.querySelectorAll("i").forEach((b) => { b.style.height = b.dataset.h + "%"; })); countUp(n, Math.round(W.avgRating * 10), (v) => fmt1(v / 10));
  } });
  const topSlide = (W) => ({ t: "t-review", dur: 8, r(root) {
    const t = W.top; root.append(say("Yılın favorileri"), big(t[0].name, 16), say(`${stars(t[0].rating)} ile en yüksek puanın.`, true), el("div", "grow"));
    K.gfx.rankBars(root, t.map((x, i) => ({ label: x.name, text: stars(x.rating), pct: (x.rating / 5) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const decadeSlide = (W) => ({ t: "t-ink", dur: 7.5, r(root) {
    const d = W.decades.slice(0, 5), mx = d[0].n; root.append(say("En çok izlediğin dönem"), big(d[0].name, 22), say(`${d[0].n} film. Ortalama yapım yılın ${Math.round(W.avgYear)}.${W.oldest ? ` En eskisi ${W.oldest.name} (${W.oldest.year}).` : ""}`, true), el("div", "grow"));
    K.gfx.rankBars(root, d.map((x, i) => ({ label: x.name, text: `${x.n} film`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const firstLastSlide = (W) => ({ t: "t-ink", dur: 7, r(root) {
    root.append(say("Yılı şu filmle açtın"), big(W.first.name, 14), say(fmtDay(W.first.date), true), el("div", "grow"), say("Şimdilik son film"), big(W.last.name, 14), say(fmtDay(W.last.date), true), el("div", "grow"));
  } });
  const rewatchSlide = (W) => ({ t: "t-open", r(root) {
    const n = big("0", 46); root.append(say("Yeniden izlediğin"), n, say("film."), say(W.rewatched.length ? `Örneğin: ${W.rewatched.map((f) => f.name).join(", ")}.` : "", true)); countUp(n, W.rewatch);
  } });

  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const CLAP = svg('<path d="M3 9h18v11H3zM3 9l3-5h4L7 9M10 9l3-5h4l-3 5M17 9l3-5"/>', "none");
  const ICON_SET = {
    "Klasik Avcısı": svg('<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>'), "Vizyon Takipçisi": svg('<path d="M12 2l2.5 6.500L21 9l-5 4.500L17.500 21 12 17.200 6.500 21 8 13.500 3 9l6.500-.500z"/>'),
    "Cömert Puancı": svg('<path d="M12 21s-8-5.200-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 10c0 5.800-8 11-8 11z"/>'), "Sert Eleştirmen": svg('<path d="M4 20 20 4M14 4h6v6"/>', "none"),
    "Tekrar İzleyen": svg('<path d="M4 12a8 8 0 0 1 14-5.300M20 12a8 8 0 0 1-14 5.300M18 3v4h-4M6 21v-4h4"/>', "none"), "Film Maratoncusu": svg('<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2"/>', "none"),
    "Hafta Sonu Sinemacısı": svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', "none"), "Dönem Gezgini": svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>', "none"), "Sinema Gezgini": CLAP,
  };
  ICON_SET.default = CLAP;

  Wrapped.register({
    id: "film", name: "Film Wrapped", brand: "Film Wrapped", icon: CLAP, blurb: "Letterboxd günlüğünden: puanların, dönemlerin, tekrar izlemelerin.", hashtags: "#FilmWrapped #Letterboxd #Sinema", persistUrl: false,
    theme: { id: "film", skin: "film", motif: "film", wipe: "iris", css: "theme-film.css", display: '"Playfair Display",Georgia,"Times New Roman",serif', fontCheck: ['900 80px "Playfair Display"'],
      colors: { merge: "#7A1F2B", open: "#1F4A42", closed: "#C8932B", review: "#F3E9D2", link: "#2B4A6F", ink: "#141012", paper: "#F3E9D2" },
      fg: { merge: "#F3E9D2", open: "#F3E9D2", closed: "#1B1210", review: "#2A1A14", link: "#F3E9D2", ink: "#F3E9D2" } },
    input: { kind: "file", multiple: true, accept: ".zip,.csv,application/zip,text/csv", dropTitle: "Letterboxd dosyalarını buraya bırak ya da seç", dropHint: "Tüm .zip dosyası ya da diary.csv (+ isteğe bağlı ratings.csv). Dosyaların cihazından çıkmaz.",
      how: ["letterboxd.com'da Settings (Ayarlar) bölümünü aç.", "\"Import & Export\" sekmesinde \"Export Your Data\" düğmesine bas.", "İnen .zip dosyasını doğrudan buraya yükle (içinden diary, ratings ve watched dosyaları okunur; yorum metinleri okunmaz)."],
      options: [], demoLabel: "Önce örnek bir film günlüğüne bak" },
    icons: ICON_SET,
    vocab: { noun: "film", plPoss: "filmlerinin", doVerb: "izledin", doVerb1: "izledim", activeVerb: "film izledin", weekdayVerb: "film izliyorsun", busyLead: "En çok film izlediğin gün", streakLine: "gün üst üste film izledin", streakLine1: "gün üst üste film izledim", skyTitle: "Sinema şehrin", skyCard: "sinema şehrim", skyName: "Sinema şehri", introTail: "sinema yılın", introTail1: "sinema yılım", personaLead: "Sinefil kişiliğin", personaLead1: "Sinefil kişiliğim", cardLead: "Sinefil kartın hazır.", cardLead1: "Sinefil kartım", cardWho: "olarak izliyorsun", devName: "Sinefil kartı" },
    async inspect(files) {
      let films; try { films = await readFilms(files); } catch { throw mkErr("badfile"); }
      if (films.length < 5) throw mkErr("badfile");
      const yc = {}; films.forEach((f) => { const y = +f.date.slice(0, 4); yc[y] = (yc[y] || 0) + 1; });
      const years = Object.entries(yc).map(([y, n]) => ({ y: +y, n })).sort((a, b) => b.y - a.y), def = years.filter((y) => y.n >= 10).sort((a, b) => b.y - a.y)[0] || years.slice().sort((a, b) => b.n - a.n)[0];
      return { films, years, defaultYear: def.y, note: `${nf.format(films.length)} film kaydı bulundu. Yıllar: ${years.map((y) => y.y).reverse().join(", ")}.` };
    },
    async load(input, ctx) { ctx.step("Film günlüğü çözümleniyor"); await wait(250); return { year: ctx.year, films: input.meta.films, user: { login: "sinefil", name: "Sinema yılın", avatar: null } }; }, analyze, isEmpty: (W) => W.nFilms < 5,
    slides(W) {
      const sf = (n) => Wrapped.kit.sceneFor(W, n);
      const L = [SL.intro(W), ...[sf("leader")].filter(Boolean)], a = W.hasCal && W.total > 0 ? SL.activity(W) : [];
      if (a.length) L.push(a[0]);
      if (W.avgRating != null && W.rated >= 5) L.push(ratingSlide(W)); if (W.top.length >= 3) L.push(sf("strip") || topSlide(W)); if (W.decades.length >= 2) L.push(decadeSlide(W));
      L.push(...a.slice(1)); if (W.first && W.last && W.first !== W.last) L.push(firstLastSlide(W)); if (W.rewatch >= 2) L.push(rewatchSlide(W));
      if (a.length) L.push(SL.skyline(W)); L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W)); return L;
    },
    caption(W, url) { return `${W.year} Film Wrapped'ım 🎬\n${nf.format(W.nFilms)} film${W.avgRating != null ? ` · ortalama ${fmt1(W.avgRating)}` : ""} · ${W.persona.k}\nSinefil kartım: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#FilmWrapped #Letterboxd #Sinema #${W.year}`; },
    errMsg(e) { if (e.code === "badfile") return "Bu dosya Letterboxd dışa aktarımı gibi görünmüyor. Letterboxd'dan indirdiğin .zip dosyasını ya da diary.csv dosyasını yükle."; if (e.code === "empty") return "Seçilen yılda yeterli film kaydı bulunamadı. Başka bir yıl dene."; return null; },
  });
})();
