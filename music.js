/* Müzik Wrapped eklentisi: Spotify akış geçmişi (JSON ya da .zip) tamamen tarayıcıda işlenir */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { el, clamp, nf, pad, wait, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, SL } = K;
  const pct = (x) => Math.round(x * 100), COLS = ["review", "closed", "link", "open", "#B58CFF", "#7FD962", "#FF8A3D", "#9AA3B2"];
  const fmtDur = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} sa ${m} dk` : `${m} dk`; };

  /* ---- dosya okuma: JSON'lar ya da .zip içindeki JSON'lar ---- */
  async function zipJsons(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw mkErr("badfile");
    const cnt = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
    for (let i = 0; i < cnt; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const comp = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true), name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (!/\.json$/i.test(name) || !/stream|history/i.test(name) || /video|podcast|search|library|follow/i.test(name)) continue;
      const nl2 = dv.getUint16(lho + 26, true), xl2 = dv.getUint16(lho + 28, true), st = lho + 30 + nl2 + xl2, data = u8.subarray(st, st + cs);
      let bytes; if (comp === 0) bytes = data; else if (comp === 8 && typeof DecompressionStream !== "undefined") bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); else continue;
      out.push({ name, text: new TextDecoder("utf-8").decode(bytes) });
    }
    return out;
  }
  const PLAT = [[/android/i, "Android"], [/ios|iphone|ipad/i, "iPhone"], [/windows/i, "Windows"], [/os x|mac/i, "Mac"], [/web/i, "Web"], [/linux/i, "Linux"], [/cast|tv|sonos|speaker/i, "Hoparlör/TV"]];
  const plat = (s) => { for (const [re, n] of PLAT) if (re.test(s || "")) return n; return "Diğer"; };
  function toPlays(rows) {
    const out = [];
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      if (r.ts !== undefined) {                                           // genişletilmiş biçim
        if (!r.master_metadata_track_name || r.episode_name) continue; const end = Date.parse(r.ts), ms = +r.ms_played || 0; if (isNaN(end)) continue;
        out.push({ t: end - ms, ms, track: r.master_metadata_track_name, artist: r.master_metadata_album_artist_name || "?", album: r.master_metadata_album_album_name || "", skip: r.skipped === true || r.reason_end === "fwdbtn", shuffle: r.shuffle === true, offline: r.offline === true, plat: plat(r.platform) });
      } else if (r.endTime !== undefined) {                               // standart biçim (son 1 yıl)
        const end = Date.parse(String(r.endTime).replace(" ", "T") + ":00Z"), ms = +r.msPlayed || 0; if (isNaN(end) || !r.trackName) continue;
        out.push({ t: end - ms, ms, track: r.trackName, artist: r.artistName || "?", album: "", skip: ms < 30000, shuffle: false, offline: false, plat: "Diğer" });
      }
    }
    return out;
  }
  async function readAll(files) {
    const rows = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) { for (const j of await zipJsons(await f.arrayBuffer())) { try { const a = JSON.parse(j.text); if (Array.isArray(a)) rows.push(...a); } catch { /* bozuk dosya */ } } }
      else if (/\.json$/i.test(f.name)) { try { const a = JSON.parse(await f.text()); if (Array.isArray(a)) rows.push(...a); } catch { /* bozuk dosya */ } }
    }
    return toPlays(rows);
  }

  /* ---- analiz ---- */
  function analyze(raw) {
    const year = raw.year, ps = raw.plays.filter((p) => new Date(p.t).getFullYear() === year).sort((a, b) => a.t - b.t);
    const W = { raw, year, plays: ps, user: { ...raw.user, handle: `${nf.format(ps.length)} dinleme` }, partial: year === THIS_YEAR, nPlays: ps.length };
    const streams = ps.filter((p) => p.ms >= 30000); W.streams = streams.length; W.minutesTotal = ps.reduce((s, p) => s + p.ms, 0) / 60000;
    const dc = {}; ps.forEach((p) => { const d = localISO(new Date(p.t)); dc[d] = (dc[d] || 0) + p.ms / 60000; });
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31); for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: Math.round(dc[iso] || 0) }); }
    activity(W, { days: ps.length ? days : [], hourTimes: streams.map((p) => p.t), minHours: 50 });
    W.hoursNote = "Saatler, çalmaya başladığın ana göre ve bu cihazın saat dilimiyle gösterilir.";
    const am = {}, tm = {}, alb = {}; streams.forEach((p) => { am[p.artist] = (am[p.artist] || 0) + p.ms / 60000; const k = p.artist + "\u0001" + p.track; (tm[k] = tm[k] || { artist: p.artist, track: p.track, n: 0 }).n++; if (p.album) alb[p.album] = (alb[p.album] || 0) + p.ms / 60000; });
    W.artists = Object.entries(am).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, m]) => ({ name, min: m })); W.artistCount = Object.keys(am).length; W.trackCount = Object.keys(tm).length;
    W.tracks = Object.values(tm).sort((a, b) => b.n - a.n).slice(0, 6); W.albums = Object.entries(alb).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, m]) => ({ name, min: m }));
    const sumA = Object.values(am).reduce((a, b) => a + b, 0) || 1; W.topArtistShare = W.artists[0] ? W.artists[0].min / sumA : 0;
    W.skipRate = ps.length ? ps.filter((p) => p.skip || p.ms < 30000).length / ps.length : 0; W.shuffleShare = ps.length ? ps.filter((p) => p.shuffle).length / ps.length : 0;
    const pc = {}; ps.forEach((p) => { pc[p.plat] = (pc[p.plat] || 0) + p.ms; }); const pt = Object.values(pc).reduce((a, b) => a + b, 0) || 1;
    W.platforms = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, v], i) => ({ name, pct: (v / pt) * 100, color: COLS[i % COLS.length] }));
    let best = { ms: 0, n: 0, s: 0 }, cs = ps.length ? ps[0].t : 0, cm = 0, cn = 0, last = 0;
    for (const p of ps) { if (cn && p.t - last > 20 * 60e3) { if (cm > best.ms) best = { ms: cm, n: cn, s: cs }; cs = p.t; cm = 0; cn = 0; } cm += p.ms; cn++; last = p.t + p.ms; } if (cm > best.ms) best = { ms: cm, n: cn, s: cs }; W.session = best.ms ? { min: best.ms / 60000, n: best.n, date: localISO(new Date(best.s)) } : null;
    const prevYears = raw.plays.some((p) => new Date(p.t).getFullYear() < year);
    if (prevYears) { const first = {}; raw.plays.forEach((p) => { if (!first[p.artist] || p.t < first[p.artist]) first[p.artist] = p.t; }); W.newArtists = Object.entries(first).filter(([a, t]) => new Date(t).getFullYear() === year && am[a]).length; } else W.newArtists = null;
    const nightS = W.nightShare || 0, n1 = Math.max(W.streams, 1), topTrack = W.tracks[0];
    const o = [];
    if (W.hours && nightS >= 0.25) o.push({ k: "Gece Dinleyicisi", w: nightS / 0.25, d: "Gece sessizleşince müzik açılıyor.", why: `Dinlemelerinin ${pcAcc(pct(nightS))} gece 22–04 arası` });
    if (W.skipRate >= 0.4) o.push({ k: "Atlayıcı", w: W.skipRate / 0.4, d: "İlk saniyede karar veriyorsun.", why: `Dinlemelerinin ${pcAcc(pct(W.skipRate))} atlandı` });
    if (W.topArtistShare >= 0.15) o.push({ k: "Sadık Dinleyici", w: W.topArtistShare / 0.15, d: "Bir sanatçıya gönül verdin mi bırakmıyorsun.", why: `${W.artists[0].name}, dinleme süresinin ${pcAcc(pct(W.topArtistShare))}` });
    if (W.artistCount >= 200) o.push({ k: "Keşifçi", w: W.artistCount / 200, d: "Her hafta yeni bir sanatçı buluyorsun.", why: `${nf.format(W.artistCount)} farklı sanatçı` });
    if (topTrack && topTrack.n >= 80) o.push({ k: "Tekrar Kralı", w: topTrack.n / 80, d: "Bir şarkı bitti mi başa sarıyorsun.", why: `"${topTrack.track}" ${topTrack.n} kez` });
    if (W.minutesTotal >= 40000) o.push({ k: "Maraton Dinleyici", w: W.minutesTotal / 40000, d: "Kulaklık neredeyse vücudunun bir parçası.", why: `${nf.format(Math.round(W.minutesTotal / 60))} saat müzik` });
    if (W.hours && (W.morningShare || 0) >= 0.3) o.push({ k: "Sabah Playlist'çisi", w: W.morningShare / 0.3, d: "Güne ritimle başlıyorsun.", why: `Dinlemelerinin ${pcAcc(pct(W.morningShare))} sabah 05–10 arası` });
    o.sort((a, b) => b.w - a.w); W.persona = o[0] || { k: "Dengeli Dinleyici", d: "Müzik hayatının her yerinde ama ölçülü.", why: "Dengeli bir dinleme" }; W.personaWhy = o.slice(0, 3).map((x) => x.why);
    const R = [], ad = (w, tag, t) => R.push({ w, tag, t });
    if (W.skipRate >= 0.35) ad(W.skipRate * 3, "atla", `Dinlemelerinin ${pcAcc(pct(W.skipRate))} atlandı. Şarkılara bir şans daha versen?`);
    if (topTrack && topTrack.n >= 50) ad(topTrack.n / 60, "tekrar", `"${topTrack.track}" ${topTrack.n} kez çaldı. Komşuların da ezberlemiştir.`);
    if (W.hours && nightS >= 0.2) ad(nightS * 3, "gece", `Dinlemelerinin ${pcAcc(pct(nightS))} gece 22 ile 04 arasında. Komşular sessiz bir şarkı seçmeni rica ediyor.`);
    if (W.topArtistShare >= 0.15) ad(2, "sanatci", `${W.artists[0].name}, tüm dinleme süreninin ${pcAcc(pct(W.topArtistShare))}. Hayran kulübünde üyelik kartın hazır.`);
    if (W.session && W.session.min >= 240) ad(W.session.min / 300, "seans", `${fmtDur(W.session.min)} aralıksız dinledin. Su içmeyi unutma.`);
    if (W.busy && W.avgActive && W.busy.count / W.avgActive >= 4) ad(1.2, "gun", `${fmtDay(W.busy.date)} günü tam ${fmtDur(W.busy.count)} müzik dinlemişsin. Ne oldu o gün?`);
    if (W.newArtists != null && W.newArtists >= 100) ad(1, "yeni", `${nf.format(W.newArtists)} yeni sanatçı keşfettin. Müzik zevkin yaşıyor.`);
    R.sort((a, b) => b.w - a.w); const out = [], tg = new Set(); for (const x of R) { if (out.length >= 3) break; if (!tg.has(x.tag)) { tg.add(x.tag); out.push(x.t); } }
    for (const f of ["Dinleme geçmişin dengeli bir zevk gösteriyor. Tebrikler, bu nadir.", "Kulaklığın bu yıl çok çalıştı.", "Çalma listen seni iyi anlatıyor."]) { if (out.length >= 3) break; out.push(f); }
    W.roasts = out;
    finishCard(W, [["SÜR", scoreK(W.minutesTotal / 60, 400)], ["ÇEŞ", scoreK(W.artistCount, 120)], ["SDK", 35 + 64 * clamp(1 - W.skipRate, 0, 1)], ["GEC", 35 + 64 * clamp(nightS / 0.4, 0, 1)], ["TKR", scoreK(topTrack ? topTrack.n : 0, 60)], ["İST", 35 + 64 * clamp((W.active / Math.max(W.elapsed, 1)) / 0.8, 0, 1)]]);
    W.poster = { blocks: [[nf.format(Math.round(W.minutesTotal / 60)), "saat müzik", "open"], [nf.format(W.streams), "dinleme", "closed"], [nf.format(W.artistCount), "sanatçı", "review"], [`%${pct(W.skipRate)}`, "atlama oranı", "link"]], chips: W.artists.slice(0, 3).map((a, i) => ({ name: a.name, color: COLS[i] })), waffle: W.platforms.map((x) => ({ pct: x.pct, color: x.color })) };
    if (W.artists.length >= 4) W.wordsCard = { name: "Sanatçılar", title: "En çok dinlediğin sanatçılar", words: W.artists.map((a) => ({ w: a.name, n: Math.round(a.min) })), lines: [`En çok dinlediğin: ${W.artists[0].name} (${fmtDur(W.artists[0].min)}).`, `${nf.format(W.artistCount)} farklı sanatçı dinledin.`] };
    return W;
  }

  /* ---- slaytlar ---- */
  const timeSlide = (W) => ({ t: "t-merge", r(root) {
    const n = big("0", 46), h = Math.round(W.minutesTotal / 60), d = Math.floor(h / 24);
    root.append(say("Bu yıl müzik dinlediğin süre"), n, say("saat."), say(`${nf.format(W.streams)} şarkı dinlemesi, ${nf.format(W.artistCount)} sanatçı, ${nf.format(W.trackCount)} farklı şarkı.${d >= 1 ? ` Bu, ${d} gün ${h % 24} saat kesintisiz müzik.` : ""}`, true)); countUp(n, h);
  } });
  const artistSlide = (W) => ({ t: "t-link", dur: 7.5, r(root) {
    const a = W.artists, mx = a[0].min; root.append(say("En çok dinlediğin sanatçı"), big(a[0].name, 16), say(`${fmtDur(a[0].min)} dinledin. Toplamın %${pct(W.topArtistShare)} kadarı.`, true), el("div", "grow"));
    K.gfx.rankBars(root, a.slice(0, 5).map((x, i) => ({ label: x.name, text: fmtDur(x.min), pct: (x.min / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const trackSlide = (W) => ({ t: "t-closed", dur: 7.5, r(root) {
    const t = W.tracks, mx = t[0].n; root.append(say("En çok çalan şarkın"), big(t[0].track, 16), say(`${t[0].artist}. ${nf.format(t[0].n)} kez dinledin.`, true), el("div", "grow"));
    K.gfx.rankBars(root, t.slice(0, 5).map((x, i) => ({ label: x.track, text: `${nf.format(x.n)} kez`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const skipSlide = (W) => ({ t: "t-review", r(root) {
    const n = big("0", 46), s = pct(W.skipRate), sh = pct(W.shuffleShare); root.append(say("Atlama oranın"), n, say("dinlemeyi 30 saniyeden önce bıraktın."), say(W.skipRate >= 0.4 ? "Sabırsız bir dinleyicisin." : W.skipRate <= 0.15 ? "Şarkıyı sonuna kadar dinleyen nadir insanlardansın." : "Dengeli bir dinleyicisin.", true), el("div", "grow"));
    countUp(n, s, (v) => `%${v}`); const rows = el("div", "cmp"); [["Atladığın", s, "now"], ["Sonuna kadar", 100 - s, "prev"]].forEach(([lab, v, cls]) => { const r = el("div", "cmp-row"); r.append(el("span", "", lab), el("b", "", `%${v}`)); const bar = el("i", "cmp-bar " + cls); bar.dataset.w = Math.max(v, 2); r.append(bar); rows.append(r); });
    root.append(rows); if (W.shuffleShare > 0) root.append(say(`Karışık çalma kullanımın: %${sh}.`, true)); after(() => rows.querySelectorAll(".cmp-bar").forEach((b) => { b.style.width = b.dataset.w + "%"; }));
  } });
  const sessionSlide = (W) => ({ t: "t-open", r(root) {
    const S = W.session; root.append(say("En uzun dinleme seansın"), big(fmtDur(S.min), 20), say(`${fmtDay(S.date)} günü ${nf.format(S.n)} şarkıyı aralıksız dinledin.`, true), say("İki şarkı arası 20 dakikadan kısaysa seans devam eder sayılır.", true));
  } });
  const platSlide = (W) => ({ t: "t-ink", r(root) {
    const p = W.platforms[0]; root.append(say("En çok kullandığın cihaz"), big(p.name, 22), say(`Dinleme süreninin %${Math.round(p.pct)} bu cihazda. Her kare, sürenin %1'i.`));
    K.gfx.waffleCanvas(fillBox(root), W.platforms.map((x) => ({ pct: x.pct, color: x.color }))); const lg = el("div", "legend"); W.platforms.forEach((x) => { const row = el("div"), dot = el("i"); dot.style.background = K.PAL[x.color] || x.color; row.append(dot, el("span", "", x.name), el("span", "", `%${Math.round(x.pct)}`)); lg.append(row); }); root.append(lg);
  } });
  const newSlide = (W) => ({ t: "t-link", r(root) { const n = big("0", 46); root.append(say("Bu yıl keşfettiğin"), n, say("yeni sanatçı."), say("Geçmiş yıllarda hiç dinlemediğin sanatçılar sayılır.", true)); countUp(n, W.newArtists); } });
  async function drawTracksCard(S) {
    const C = K.cards, PL = K.PAL, FG = K.FGC; await C.prepCards(S); const { cv, c } = C.newCard(PL.closed); C.deco(c, S, FG.closed, 0.13); C.head(c, S, FG.closed);
    C.stretch(c, "expanded"); c.fillStyle = FG.closed; const fs = C.fitFont(c, "En çok çalanlar", 936, 96, 900); c.font = `900 ${fs}px ${C.DISP}`; c.fillText("En çok çalanlar", C.CM - 4, 450);
    S.tracks.slice(0, 6).forEach((t, i) => {
      const y = 520 + i * 152; c.fillStyle = PL.paper; C.rr(c, C.CM, y, C.CW - C.CM * 2, 132, 30); c.fillStyle = PL.ink; C.stretch(c, "expanded"); c.font = `900 54px ${C.DISP}`; c.fillText(String(i + 1), C.CM + 30, y + 86);
      C.stretch(c, "normal"); c.font = `800 38px ${C.SANS}`; const nm = t.track.length > 24 ? t.track.slice(0, 23) + "…" : t.track; c.fillText(nm, C.CM + 110, y + 58);
      c.font = `600 30px ${C.SANS}`; c.globalAlpha = 0.75; c.fillText(t.artist.length > 26 ? t.artist.slice(0, 25) + "…" : t.artist, C.CM + 110, y + 100); c.textAlign = "right"; c.font = `800 34px ${C.SANS}`; c.fillText(`${nf.format(t.n)}×`, C.CW - C.CM - 30, y + 80); c.textAlign = "left"; c.globalAlpha = 1;
    });
    C.foot(c, FG.closed); return cv;
  }
  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const DISC = svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="0"/>');
  const ICON_SET = {
    "Gece Dinleyicisi": svg('<path d="M20.6 14.4A9 9 0 0 1 9.6 3.4a9 9 0 1 0 11 11z"/>'), "Atlayıcı": svg('<path d="M5 4l9 8-9 8zM17 4v16"/>', "none"), "Sadık Dinleyici": svg('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>'),
    "Keşifçi": svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>', "none"), "Tekrar Kralı": svg('<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>', "none"),
    "Maraton Dinleyici": svg('<path d="M3 14a9 9 0 0 1 18 0v6h-4v-6M3 14v6h4v-6"/>', "none"), "Sabah Playlist'çisi": svg('<circle cx="12" cy="12" r="4.4"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7"/>', "none"), "Dengeli Dinleyici": DISC,
  };
  ICON_SET.default = DISC;

  Wrapped.register({
    id: "music", name: "Müzik Wrapped", brand: "Müzik Wrapped", icon: DISC, blurb: "Spotify geçmişinden: sanatçılar, şarkılar, atlama oranı.", hashtags: "#MüzikWrapped #Spotify #Müzik", persistUrl: false,
    theme: { id: "music", skin: "music", motif: "bars", wipe: "bars", css: "theme-music.css", display: '"Unbounded","Arial Black",sans-serif', fontCheck: ['900 80px "Unbounded"'],
      colors: { merge: "#FF5A36", open: "#7B2CBF", closed: "#F72585", review: "#FFD166", link: "#06B6D4", ink: "#120B1F", paper: "#FFF6EC" },
      fg: { merge: "#FFF6EC", open: "#FFF6EC", closed: "#FFFFFF", review: "#1B1030", link: "#04202A", ink: "#FFF6EC" } },
    input: { kind: "file", multiple: true, accept: ".json,.zip,application/json,application/zip", dropTitle: "Spotify dosyalarını buraya bırak ya da seç", dropHint: "StreamingHistory .json dosyaları ya da tüm .zip. Dosyaların cihazından çıkmaz.",
      how: ["Spotify hesap sayfasında Gizlilik ayarları bölümüne gir.", "\"Veri indirmeyi iste\" altında \"Genişletilmiş akış geçmişi\" seçeneğini işaretle ve iste (hazırlanması birkaç gün sürebilir).", "E-postadaki .zip dosyasını doğrudan buraya yükle (içindeki Streaming_History_Audio .json dosyaları okunur). Konum ve IP bilgileri kullanılmaz."],
      options: [], demoLabel: "Önce örnek bir geçmişe bak" },
    icons: ICON_SET,
    vocab: { noun: "dakika", plPoss: "dinlemelerinin", doVerb: "dinledin", doVerb1: "dinledim", activeVerb: "müzik dinledin", weekdayVerb: "müzik dinliyorsun", night: "Gece dinleyicisisin.", morning: "Sabah dinleyicisisin.", evening: "Akşam dinleyicisisin.", day: "Gün boyu dinleyicisin.", hoursLead: "En çok dinlediğin saat",
      busyLead: "En çok dinlediğin gün", streakLine: "gün üst üste müzik dinledin", streakLine1: "gün üst üste müzik dinledim", skyTitle: "Ses şehrin", skyCard: "ses şehrim", skyName: "Ses şehri", introTail: "müzik yılın", introTail1: "müzik yılım", personaLead: "Dinleme kişiliğin", personaLead1: "Dinleme kişiliğim", cardLead: "Dinleyici kartın hazır.", cardLead1: "Dinleyici kartım", cardWho: "olarak dinliyorsun", devName: "Dinleyici kartı", totalLead: "Bu yıl toplam" },
    async inspect(files) {
      let plays; try { plays = await readAll(files); } catch { throw mkErr("badfile"); }
      if (plays.length < 50) throw mkErr("badfile");
      const yc = {}; plays.forEach((p) => { const y = new Date(p.t).getFullYear(); yc[y] = (yc[y] || 0) + 1; });
      const years = Object.entries(yc).map(([y, n]) => ({ y: +y, n })).sort((a, b) => b.y - a.y), def = years.filter((y) => y.n >= 200).sort((a, b) => b.y - a.y)[0] || years.slice().sort((a, b) => b.n - a.n)[0];
      return { plays, years, defaultYear: def.y, note: `${nf.format(plays.length)} dinleme kaydı bulundu. Yıllar: ${years.map((y) => y.y).reverse().join(", ")}.` };
    },
    async load(input, ctx) { ctx.step("Dinleme geçmişi çözümleniyor"); await wait(250); return { year: ctx.year, plays: input.meta.plays, user: { login: "dinleyici", name: "Müzik yılın", avatar: null } }; }, analyze, isEmpty: (W) => W.nPlays < 50,
    slides(W) {
      const L = [SL.intro(W), timeSlide(W)]; const sf = (n) => Wrapped.kit.sceneFor(W, n);
      if (W.artists.length >= 1) L.push(...[sf("vinyl")].filter(Boolean));
      if (W.hasCal && W.total > 0) { const a = SL.activity(W); L.push(a[0]); }
      if (W.artists.length >= 3) L.push(artistSlide(W));
      if (W.tracks.length >= 3) L.push(trackSlide(W));
      L.push(sf("skipbelt") || skipSlide(W));
      if (W.hasCal && W.total > 0) L.push(...SL.activity(W).slice(1));
      if (W.hours) L.push(SL.hours(W));
      if (W.session) L.push(sessionSlide(W));
      if (W.platforms.length >= 2) L.push(platSlide(W));
      if (W.newArtists != null && W.newArtists >= 5) L.push(newSlide(W));
      if (W.hasCal && W.total > 0) L.push(SL.skyline(W));
      L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W)); return L;
    },
    extraCards(S) { return [["tracks", "Şarkılar", drawTracksCard, S.tracks.length >= 3]]; },
    caption(W, url) { return `${W.year} Müzik Wrapped'ım 🎧\n${nf.format(Math.round(W.minutesTotal / 60))} saat · ${nf.format(W.artistCount)} sanatçı · ${W.persona.k}\nDinleyici kartım: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#MüzikWrapped #Spotify #${W.year}`; },
    errMsg(e) { if (e.code === "badfile") return "Bu dosya Spotify akış geçmişi gibi görünmüyor. \"Genişletilmiş akış geçmişi\" .zip dosyasını ya da içindeki Streaming_History_Audio .json dosyalarını yükle."; if (e.code === "empty") return "Seçilen yılda yeterli dinleme kaydı bulunamadı. Başka bir yıl dene."; return null; },
  });
})();
