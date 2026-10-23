/* Satranç Wrapped eklentisi: Lichess ve Chess.com herkese açık verileri */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { $, el, clamp, nf, pad, wait, hash, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, pcLoc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, SL } = K;
  const enc = encodeURIComponent, pct = (x) => Math.round(x * 100);
  const SPEED_TR = { ultrabullet: "Ultra bullet", bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Klasik", correspondence: "Yazışmalı", daily: "Günlük" };
  const SPEED_COL = { ultrabullet: "#FF5A5A", bullet: "#FF8A3D", blitz: "#F7DF1E", rapid: "#2FD1A4", classical: "#4F8CFF", correspondence: "#B58CFF", daily: "#B58CFF" };
  const FAST = new Set(["ultrabullet", "bullet", "blitz"]);
  const OPEN_COL = ["#FFC933", "#2FD1A4", "#4F8CFF", "#FF8A3D", "#B58CFF"];

  /* =====================================================
     Veri katmanı
  ===================================================== */
  async function jget(url) {
    let r; try { r = await fetch(url); } catch { throw mkErr("network"); }
    if (r.status === 404) throw mkErr("notfound"); if (r.status === 429) throw mkErr("ratelimit", Date.now() + 60000);
    if (!r.ok) throw mkErr("http", r.status); return r.json();
  }
  async function lichessLoad(user, year, step) {
    step("Profil alınıyor");
    const pr = await jget(`https://lichess.org/api/user/${enc(user)}`);
    const since = new Date(year, 0, 1).getTime(), until = new Date(year + 1, 0, 1).getTime();
    step("Oyunlar indiriliyor");
    let r; try { r = await fetch(`https://lichess.org/api/games/user/${enc(user)}?since=${since}&until=${until}&max=4000&opening=true&moves=false&clocks=false&evals=false&tags=false&lastFen=false`, { headers: { Accept: "application/x-ndjson" } }); } catch { throw mkErr("network"); }
    if (r.status === 404) throw mkErr("notfound"); if (r.status === 429) throw mkErr("ratelimit", Date.now() + 60000); if (!r.ok) throw mkErr("http", r.status);
    const rows = [], rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { try { rows.push(JSON.parse(line)); } catch { /* bozuk satır */ } } }
      step(`${nf.format(rows.length)} oyun alındı`);
    }
    if (buf.trim()) { try { rows.push(JSON.parse(buf)); } catch { /* son satır */ } }
    const id = (pr.id || user).toLowerCase(), games = [];
    for (const g of rows) {
      if (g.variant && g.variant !== "standard") continue; if (g.status === "aborted" || g.status === "noStart") continue;
      const w = g.players && g.players.white, b = g.players && g.players.black; if (!w || !b) continue;
      const isW = ((w.user && w.user.id) || "").toLowerCase() === id || ((w.user && w.user.name) || "").toLowerCase() === user.toLowerCase();
      const me = isW ? w : b, op = isW ? b : w;
      games.push({ t: g.createdAt, win: g.winner ? ((g.winner === "white") === isW ? 1 : 0) : 0.5, white: isW, speed: String(g.speed || "blitz").toLowerCase(), rating: me.rating, opp: op.rating, opening: g.opening && g.opening.name ? g.opening.name.split(":")[0].trim() : null, rated: !!g.rated });
    }
    return { platform: "lichess", year, user: { login: pr.username || user, name: (pr.profile && ([pr.profile.firstName, pr.profile.lastName].filter(Boolean).join(" "))) || pr.username || user, avatar: null }, games };
  }
  const DRAWS = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);
  function slugFamily(pgn) {
    const m = /\[ECOUrl "[^"]*\/openings\/([^"\]]+)"\]/.exec(pgn || ""); if (!m) return null;
    const ws = m[1].split("-").filter((x) => !/^\d/.test(x)), STOPW = ["Variation", "Line", "Gambit", "System", "Attack", "Opening", "Game", "Defense", "Defence"], out = [];
    for (const w of ws) { out.push(w); if (STOPW.includes(w) || out.length >= 3) break; }
    return out.join(" ");
  }
  async function chesscomLoad(user, year, step) {
    step("Profil alınıyor");
    const pr = await jget(`https://api.chess.com/pub/player/${enc(user.toLowerCase())}`);
    step("Arşivler taranıyor");
    const arc = await jget(`https://api.chess.com/pub/player/${enc(user.toLowerCase())}/games/archives`);
    const urls = (arc.archives || []).filter((u) => new RegExp(`/${year}/\\d\\d$`).test(u)), games = [], me = user.toLowerCase();
    for (let k = 0; k < urls.length; k++) {
      step(`Ay ${k + 1} / ${urls.length} indiriliyor`);
      const j = await jget(urls[k]);
      for (const g of j.games || []) {
        if (g.rules && g.rules !== "chess") continue;
        const isW = String((g.white && g.white.username) || "").toLowerCase() === me, mePl = isW ? g.white : g.black, opPl = isW ? g.black : g.white; if (!mePl || !opPl) continue;
        games.push({ t: (g.end_time || 0) * 1000, win: mePl.result === "win" ? 1 : DRAWS.has(mePl.result) ? 0.5 : 0, white: isW, speed: String(g.time_class || "blitz").toLowerCase(), rating: mePl.rating, opp: opPl.rating, opening: slugFamily(g.pgn), rated: g.rated !== false });
      }
    }
    return { platform: "chesscom", year, user: { login: pr.username || user, name: pr.name || pr.username || user, avatar: pr.avatar || null }, games };
  }

  /* =====================================================
     Analiz
  ===================================================== */
  function analyze(raw) {
    const year = raw.year, games = raw.games.filter((g) => new Date(g.t).getFullYear() === year).sort((a, b) => a.t - b.t);
    const W = { raw, year, games, user: { ...raw.user, handle: "@" + raw.user.login }, partial: year === THIS_YEAR, nGames: games.length };
    const cnt = {}; for (const g of games) { const d = localISO(new Date(g.t)); cnt[d] = (cnt[d] || 0) + 1; }
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31);
    for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: cnt[iso] || 0 }); }
    activity(W, { days: games.length ? days : [], hourTimes: games.map((g) => g.t), minHours: 20 });
    W.hoursNote = `Son ${nf.format(W.hourN)} oyununa göre. Saatler bu cihazın saat dilimiyle gösterilir.`;
    const n = games.length || 1, wins = games.filter((g) => g.win === 1).length, draws = games.filter((g) => g.win === 0.5).length, losses = games.length - wins - draws;
    W.res = { wins, draws, losses, rate: wins / n, drawRate: draws / n };
    const wg = games.filter((g) => g.white), bg = games.filter((g) => !g.white), wr = (a) => (a.length ? a.filter((g) => g.win === 1).length / a.length : 0);
    W.colorRate = { white: wr(wg), black: wr(bg), nW: wg.length, nB: bg.length };
    const sp = {}; for (const g of games) sp[g.speed] = (sp[g.speed] || 0) + 1;
    W.speeds = Object.entries(sp).sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ k, name: SPEED_TR[k] || k, c, pct: (c / n) * 100, color: SPEED_COL[k] || "#9AA3B2" }));
    W.fastShare = games.filter((g) => FAST.has(g.speed)).length / n;
    const main = W.speeds[0], ser = main ? games.filter((g) => g.speed === main.k && g.rating) : [];
    W.rating = ser.length >= 20 ? { speed: main.name, first: ser[0].rating, last: ser[ser.length - 1].rating, peak: Math.max(...ser.map((g) => g.rating)), delta: ser[ser.length - 1].rating - ser[0].rating, pts: ser.map((g) => ({ t: g.t, v: g.rating })) } : null;
    const op = {}; for (const g of games) if (g.opening) { const o = (op[g.opening] = op[g.opening] || { name: g.opening, games: 0, pts: 0 }); o.games++; o.pts += g.win; }
    W.openings = Object.values(op).sort((a, b) => b.games - a.games).slice(0, 5).map((o) => ({ ...o, score: Math.round((o.pts / o.games) * 100) })); W.openingCount = Object.keys(op).length;
    let ws = 0, ls = 0, cw = 0, cl = 0; for (const g of games) { if (g.win === 1) { cw++; cl = 0; } else if (g.win === 0) { cl++; cw = 0; } else { cw = 0; cl = 0; } ws = Math.max(ws, cw); ls = Math.max(ls, cl); }
    W.winStreak = ws; W.loseStreak = ls;
    let tg = 0, tw = 0; for (let i = 1; i < games.length; i++) if (games[i - 1].win === 0 && games[i].t - games[i - 1].t <= 10 * 60e3) { tg++; if (games[i].win === 1) tw++; }
    W.tilt = tg >= 15 ? { games: tg, win: Math.round((tw / tg) * 100), normal: Math.round(W.res.rate * 100) } : null;
    W.topSpeed = W.speeds[0] || null;

    const opts = [], fast = W.fastShare, slow = 1 - fast, nightS = W.nightShare || 0, rateP = pct(W.res.rate);
    if (fast >= 0.7) opts.push({ k: "Hız Tutkunu", w: fast / 0.7, d: "Düşünmek lüks, hamle yapmak şart.", why: `Oyunlarının ${pcAcc(pct(fast))} bullet ve blitz` });
    if (slow >= 0.5) opts.push({ k: "Sabırlı Stratejist", w: slow / 0.5, d: "Her hamle uzun uzun tartılıyor.", why: `Oyunlarının ${pcAcc(pct(slow))} rapid ve klasik` });
    if (W.hours) opts.push({ k: "Gece Oyuncusu", w: nightS / 0.3, d: "Gece oynanan oyunlar daha çok öğretir.", why: `Oyunlarının ${pcAcc(pct(nightS))} gece 22–04 arası` });
    if (ws >= 6) opts.push({ k: "Seri Kazanan", w: ws / 8, d: "Bir kez ısındı mı durmuyor.", why: `${ws} oyunluk galibiyet serisi` });
    if (W.tilt && W.tilt.win < W.tilt.normal - 5) opts.push({ k: "Tilt Ustası", w: (W.tilt.normal - W.tilt.win) / 8, d: "Kaybettikten sonra bir mola, belki?", why: `Kayıptan sonra hemen oynadığında %${W.tilt.win} kazanıyorsun` });
    if (W.openingCount >= 20) opts.push({ k: "Açılış Koleksiyoncusu", w: W.openingCount / 20, d: "Her oyunda farklı bir yol deniyorsun.", why: `${W.openingCount} farklı açılış` });
    if (W.res.drawRate >= 0.12) opts.push({ k: "Beraberlik Ustası", w: W.res.drawRate / 0.12, d: "Kimse kaybetmesin, değil mi?", why: `Oyunlarının ${pcAcc(pct(W.res.drawRate))} berabere` });
    if (W.rating && W.rating.delta >= 80) opts.push({ k: "Yükselen Yıldız", w: W.rating.delta / 80, d: "Yıl başından beri sadece yukarı.", why: `${W.rating.speed} ratingin +${W.rating.delta}` });
    if (W.openings[0] && W.openings[0].games / n >= 0.35) opts.push({ k: "Sadık Açılışçı", w: 1.3, d: "Bir açılışa gönül vermişsin.", why: `${W.openings[0].name} oyunlarının ${pcAcc(pct(W.openings[0].games / n))}` });
    opts.sort((a, b) => b.w - a.w);
    W.persona = opts[0] || { k: "Satranç Yolcusu", d: "Tahtanın başında keyifli bir yıl.", why: "Dengeli bir oyuncu" }; W.personaWhy = opts.slice(0, 3).map((o) => o.why);

    const R = [], add = (w, tag, t) => R.push({ w, tag, t });
    if (W.tilt && W.tilt.win < W.tilt.normal - 4) add(W.tilt.games / 20, "tilt", `Kaybettikten hemen sonra ${W.tilt.games} kez yeni oyun açtın ve %${W.tilt.win} kazandın. Tilt senin yakın arkadaşın.`);
    if (W.hours && nightS >= 0.3) add(nightS * 3, "saat", `Oyunlarının ${pcAcc(pct(nightS))} gece 22 ile 04 arasında. Satranç tahtası uykuyu da hamle sayıyor.`);
    if (fast >= 0.7) add(fast * 2, "hiz", `Oyunlarının ${pcAcc(pct(fast))} bullet ve blitz. Düşünmek lüks, hamle yapmak şart.`);
    if (ws >= 7) add(ws / 6, "seri", `${ws} oyun üst üste kazanmışsın. Rakipler bir toplantı yapmalı.`);
    if (ls >= 6) add(ls / 6, "kayip", `Bir ara ${ls} oyun üst üste kaybettin. Kalkıp bir su içmek mantıklıydı.`);
    if (W.openings[0] && W.openings[0].games / n >= 0.3) add(2, "acilis", `Oyunlarının ${pcAcc(pct(W.openings[0].games / n))} aynı açılışla başlıyor: ${W.openings[0].name}. Rakipler artık ezberlemiş olabilir.`);
    if (W.res.drawRate >= 0.15) add(1.4, "bere", `Beraberlik oranın ${pcAcc(pct(W.res.drawRate))}. Kimse kaybetmesin istiyorsun, anlıyoruz.`);
    if (W.rating && W.rating.delta >= 100) add(1.5, "rating", `Ratingin yıl içinde ${W.rating.delta} puan yükseldi. Bir şeyler öğrenmişsin.`);
    if (W.rating && W.rating.delta <= -100) add(1.5, "rating", `Ratingin ${Math.abs(W.rating.delta)} puan düştü. Düşüş de öğretir, söz.`);
    if (W.busy && W.avgActive && W.busy.count / W.avgActive >= 5) add(W.busy.count / W.avgActive / 4, "zirve", `Tek günde ${W.busy.count} oyun. Ya turnuva vardı ya da ödev ertelendi.`);
    if (games.length && games.length < 60) add(1, "az", `Bu yıl ${games.length} oyun. Kalite miktarın önünde, değil mi?`);
    R.sort((a, b) => b.w - a.w); const out = [], tags = new Set();
    for (const x of R) { if (out.length >= 3) break; if (!tags.has(x.tag)) { tags.add(x.tag); out.push(x.t); } }
    for (const x of R) { if (out.length >= 3) break; if (!out.includes(x.t)) out.push(x.t); }
    for (const f of ["Verilerine bakılırsa tahtayı ciddiye alıyorsun. Tebrikler, bu da bir şey.", "İstatistiklerin dengeli bir oyuncu portresi çiziyor.", "Bu yıl da hamle yaptın, tahta seni özledi."]) { if (out.length >= 3) break; out.push(f); }
    W.roasts = out;

    finishCard(W, [["HIZ", 35 + 64 * fast], ["TAK", 35 + 64 * clamp((W.res.rate - 0.3) / 0.4, 0, 1)], ["İST", 35 + 64 * clamp((W.active / Math.max(W.elapsed, 1)) / 0.6, 0, 1)], ["SER", scoreK(ws, 8)], ["GEC", 35 + 64 * clamp(nightS / 0.5, 0, 1)], ["AÇL", scoreK(W.openingCount, 15)]]);
    W.poster = {
      blocks: [[nf.format(games.length), "oyun", "open"], [`%${rateP}`, "galibiyet oranı", "closed"], [W.rating ? nf.format(W.rating.peak) : "—", "en yüksek rating", "review"], [String(ws), "oyunluk galibiyet serisi", "link"]],
      chips: W.openings.slice(0, 3).map((o, i) => ({ name: o.name, color: OPEN_COL[i] })), waffle: W.speeds.map((s) => ({ pct: s.pct, color: s.color })),
    };
    if (W.openings.length >= 3) W.wordsCard = { name: "Açılışlar", title: "En çok oynadığın açılışlar", words: W.openings.map((o) => ({ w: o.name, n: o.games })), lines: [`En sevdiğin: ${W.openings[0].name} (${W.openings[0].games} oyun).`, `Bu açılışta skorun %${W.openings[0].score}.`] };
    return W;
  }

  /* =====================================================
     Satranca özgü slaytlar
  ===================================================== */
  const resultSlide = (W) => ({ t: "t-link", r(root) {
    const r = W.res, n = big("0", 46), tot = Math.max(W.nGames, 1);
    root.append(say("Sonuçların"), n, say("galibiyet oranı."), say(`${nf.format(r.wins)} galibiyet, ${nf.format(r.draws)} beraberlik, ${nf.format(r.losses)} yenilgi. Beyazla %${pct(W.colorRate.white)}, siyahla %${pct(W.colorRate.black)} kazandın.`, true), el("div", "grow"));
    const bar = el("div", "wdl"); [[r.wins, "var(--fg)"], [r.draws, "color-mix(in srgb, var(--fg) 45%, transparent)"], [r.losses, "var(--ink)"]].forEach(([v, c]) => { const i = el("i"); i.style.background = c; i.style.flex = String(Math.max(v, 0.0001)); bar.append(i); });
    const key = el("div", "wdl-key"); [["Galibiyet", r.wins], ["Beraberlik", r.draws], ["Yenilgi", r.losses]].forEach(([a, b]) => key.append(el("span", "", `${a} ${nf.format(b)}`)));
    root.append(bar, key); countUp(n, pct(r.rate), (v) => `%${v}`);
  } });
  const ratingSlide = (W) => ({ t: "t-merge", dur: 7.5, r(root) {
    const R = W.rating, up = R.delta >= 0, n = big("0", 40);
    root.append(say(`${R.speed} ratingin`), n, say(up ? "puan yükseldin." : "puan düştün."), say(`Yılı ${nf.format(R.first)} ile açtın, ${nf.format(R.last)} ile kapattın. En yüksek: ${nf.format(R.peak)}.`, true));
    K.gfx.lineChart(fillBox(root), R.pts); countUp(n, Math.abs(R.delta), (v) => `${up ? "+" : "−"}${nf.format(v)}`);
  } });
  const winStreakSlide = (W) => ({ t: "t-open", r(root) {
    const n = big("0", 46); root.append(say("En uzun galibiyet serin"), n, say("oyun üst üste kazandın."), say(W.loseStreak >= 4 ? `En kötü anın ise ${W.loseStreak} oyunluk bir yenilgi serisiydi.` : "Yenilgi serin çok kısa kaldı, harika.", true));
    K.gfx.streakGrid(fillBox(root), W.winStreak); countUp(n, W.winStreak);
  } });
  const speedSlide = (W) => ({ t: "t-ink", r(root) {
    const s = W.topSpeed; root.append(say("Zaman kontrolün"), big(s.name, 24), say(`Oyunlarının ${pcAcc(Math.round(s.pct))} ${s.name}. Her kare, oyunlarının %1'i.`));
    K.gfx.waffleCanvas(fillBox(root), W.speeds.map((x) => ({ pct: x.pct, color: x.color })));
    const lg = el("div", "legend"); W.speeds.forEach((x) => { const row = el("div"), dot = el("i"); dot.style.background = x.color; row.append(dot, el("span", "", x.name), el("span", "", `${nf.format(x.c)} oyun`)); lg.append(row); }); root.append(lg);
  } });
  const openingSlide = (W) => ({ t: "t-review", dur: 7.5, r(root) {
    const o = W.openings, mx = o[0].games;
    root.append(say("En sevdiğin açılış"), big(o[0].name, 18), say(`${nf.format(o[0].games)} oyun, skorun %${o[0].score}.`), el("div", "grow"));
    K.gfx.rankBars(root, o.map((x, i) => ({ label: x.name, text: `${nf.format(x.games)} oyun, %${x.score}`, pct: (x.games / mx) * 100, hi: i === 0 })));
    root.append(el("div", "grow"));
  } });
  const tiltSlide = (W) => ({ t: "t-closed", dur: 7.5, r(root) {
    const T = W.tilt, n = big("0", 46), mx = Math.max(T.win, T.normal, 1);
    root.append(say("Kaybettikten hemen sonra"), n, say(`galibiyet oranın. ${nf.format(T.games)} kez on dakika içinde yeni oyun açtın.`), say(T.win < T.normal ? "Bir mola vermek ratingine iyi gelebilir." : "Tilt'e girmiyorsun, soğukkanlısın.", true), el("div", "grow"));
    countUp(n, T.win, (v) => `%${v}`);
    const rows = el("div", "cmp"); [["Normalde", T.normal, "prev"], ["Kayıptan hemen sonra", T.win, "now"]].forEach(([lab, v, cls]) => { const r = el("div", "cmp-row"); r.append(el("span", "", lab), el("b", "", `%${v}`)); const bar = el("i", "cmp-bar " + cls); bar.dataset.w = Math.max(Math.round((v / mx) * 100), 2); r.append(bar); rows.append(r); });
    root.append(rows); after(() => rows.querySelectorAll(".cmp-bar").forEach((b) => { b.style.width = b.dataset.w + "%"; }));
  } });

  function duelRounds(A, B) {
    const R = [], add = (id, label, a, b, fmt) => { if (a == null || b == null) return; R.push({ id, label, a, b, fmt: fmt || ((v) => nf.format(v)), win: a > b ? "a" : b > a ? "b" : "t" }); };
    add("games", "Oyun sayısı", A.nGames, B.nGames); add("winrate", "Galibiyet oranı", pct(A.res.rate), pct(B.res.rate), (v) => `%${v}`);
    if (A.rating && B.rating) add("rating", "En yüksek rating", A.rating.peak, B.rating.peak);
    add("streak", "Galibiyet serisi", A.winStreak, B.winStreak, (v) => `${v} oyun`); add("active", "Aktif gün", A.active, B.active);
    if (A.hours && B.hours) add("night", "Gece oyunları", pct(A.nightShare), pct(B.nightShare), (v) => `%${v}`);
    add("open", "Açılış çeşitliliği", A.openingCount, B.openingCount); add("power", "Oyuncu kartı gücü", A.overall, B.overall);
    return R;
  }
  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const BOARD = '<g fill="currentColor"><rect x="2" y="2" width="5" height="5"/><rect x="12" y="2" width="5" height="5"/><rect x="7" y="7" width="5" height="5"/><rect x="17" y="7" width="5" height="5"/><rect x="2" y="12" width="5" height="5"/><rect x="12" y="12" width="5" height="5"/><rect x="7" y="17" width="5" height="5"/><rect x="17" y="17" width="5" height="5"/></g>';
  const ICON_SET = {
    "Hız Tutkunu": svg('<path d="M13.6 1.8 4.4 13.6h6.4l-1.1 8.6 9.9-12.2h-6.5z"/>'),
    "Sabırlı Stratejist": svg('<path d="M6 2.5h12M6 21.5h12M7 2.5c0 5 5 5.5 5 9.5s-5 4.5-5 9.5M17 2.5c0 5-5 5.5-5 9.5s5 4.5 5 9.5"/>', "none"),
    "Gece Oyuncusu": svg('<path d="M20.6 14.4A9 9 0 0 1 9.6 3.4a9 9 0 1 0 11 11z"/>'),
    "Seri Kazanan": svg('<path d="M3 19h18l-1.5-11-4.5 4-3-8-3 8-4.5-4z"/>'),
    "Tilt Ustası": svg('<path d="M12 2.5s5 4.5 5 9.5a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1.5 3 3 3 0-3-1-6 0-8.5z"/>'),
    "Açılış Koleksiyoncusu": svg(BOARD), "Beraberlik Ustası": svg('<path d="M4 9h16M4 15h16"/>', "none"),
    "Yükselen Yıldız": svg('<path d="M12 21V4M5 11l7-7 7 7"/>', "none"), "Sadık Açılışçı": svg('<rect x="3" y="3" width="18" height="18" rx="3"/>'),
    "Satranç Yolcusu": svg(BOARD),
  };
  ICON_SET.default = ICON_SET["Satranç Yolcusu"];
  const BOARDICON = svg(BOARD);

  Wrapped.register({
    id: "chess", name: "Satranç Wrapped", brand: "Satranç Wrapped", color: "#1F6FEB", fg: "#fff", icon: BOARDICON,
    blurb: "Rating yolculuğun, açılışların, tilt anların.", hashtags: "#SatrancWrapped #Satranç #Chess",
    input: { kind: "user", label: "Satranç kullanıcı adı", placeholder: "satranç kullanıcı adı", rivalPlaceholder: "rakibinin kullanıcı adı", years: true, duel: true, platforms: [{ id: "lichess", name: "Lichess" }, { id: "chesscom", name: "Chess.com" }] },
    theme: { id: "chess", skin: "chess", motif: "checker", wipe: "checker", css: "theme-chess.css", display: '"Fraunces",Georgia,"Times New Roman",serif', fontCheck: ['900 80px "Fraunces"'],
      colors: { merge: "#355E3B", open: "#8B5A2B", closed: "#9F2F2F", review: "#E7D8B1", link: "#4B6A88", ink: "#1E1B16", paper: "#F4EFE1" },
      fg: { merge: "#F4EFE1", open: "#F7ECD9", closed: "#FFF1E6", review: "#2A2118", link: "#F4EFE1", ink: "#F4EFE1" } },
    icons: ICON_SET, duelHighlights: ["games", "winrate", "rating", "streak"],
    vocab: { noun: "oyun", plPoss: "oyunlarının", doVerb: "oynadın", doVerb1: "oynadım", activeVerb: "satranç oynadın", weekdayVerb: "oynuyorsun", night: "Gece oyuncususun.", morning: "Erkenci oyuncusun.", evening: "Akşam oyuncususun.", day: "Gündüz oyuncususun.",
      hoursLead: "En çok oynadığın saat", streakLine: "gün üst üste oynadın", streakLine1: "gün üst üste oynadım", introTail1: "satranç yılım", skyTitle: "Satranç şehrin", skyCard: "satranç şehrim", skyName: "Satranç şehri", introTail: "satranç yılın", personaLead: "Satranç kişiliğin", personaLead1: "Satranç kişiliğim", cardLead: "Oyuncu kartın hazır.", cardLead1: "Oyuncu kartım", cardWho: "olarak tahtadasın", devName: "Oyuncu kartı", streakLead1: "En uzun serim" },
    makeInput(v) {
      const plat = v.platform || "lichess", u = String(v.user || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(lichess\.org|chess\.com)\/(@\/|member\/)?/i, "").replace(/\/.*$/, "");
      if (!/^[A-Za-z0-9_-]{2,30}$/.test(u)) return { error: "Geçerli bir kullanıcı adı yaz (harf, rakam, tire ve alt çizgi)." };
      return { user: u, platform: plat, label: `@${u}`, query: { p: plat, u } };
    },
    fromQuery(q) { const u = q.get("u"); if (!u || q.get("s") !== "chess") return null; const p = q.get("p") === "chesscom" ? "chesscom" : "lichess", v = q.get("v"); return { input: { user: u, platform: p, label: "@" + u, query: { p, u } }, rival: v ? { user: v, platform: p, label: "@" + v, query: { p, u: v } } : null, year: +q.get("y") }; },
    async load(input, ctx) { return input.platform === "chesscom" ? chesscomLoad(input.user, ctx.year, ctx.step) : lichessLoad(input.user, ctx.year, ctx.step); },
    analyze, isEmpty: (W) => W.nGames === 0,
    slides(W) {
      const L = [SL.intro(W)], sf = (n) => K.sceneFor(W, n);
      if (W.hasCal && W.total > 0) { const a = SL.activity(W); L.push(a[0], resultSlide(W), ...a.slice(1)); } else L.push(resultSlide(W));
      const at = L.indexOf(L.find((x) => x.t === "t-link")) + 1;                       // sonuç slaytından sonra: tahtada mat ve yenilgi
      L.splice(at, 0, ...[W.res.wins > 0 && sf("mate"), W.res.losses > 0 && sf("fall")].filter(Boolean));
      if (W.hours) L.push(SL.hours(W));
      if (W.rating) L.push(ratingSlide(W));
      if (W.winStreak >= 3) L.push(sf("streak") || winStreakSlide(W));
      if (W.topSpeed) L.push(speedSlide(W));
      if (W.openings.length) L.push(openingSlide(W), ...[sf("opening")].filter(Boolean));
      if (W.tilt) L.push(tiltSlide(W));
      if (W.hasCal && W.total > 0) L.push(SL.skyline(W));
      L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W));
      return L;
    },
    duelRounds,
    caption(W, url) { return `${W.year} Satranç Wrapped'ım ♟️\n${nf.format(W.nGames)} oyun · %${pct(W.res.rate)} galibiyet${W.rating ? ` · en yüksek rating ${W.rating.peak}` : ""}\n${W.persona.k}\nOyuncu kartım: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#SatrancWrapped #Satranç #Chess #${W.year}`; },
    errMsg(e, who) {
      const u = String(who).replace(/^@/, "");
      switch (e.code) {
        case "notfound": return `"${u}" adında bir kullanıcı bulunamadı. Platformu doğru seçtiğinden emin ol.`;
        case "empty": return `${who} için seçilen yılda oyun bulunamadı. Başka bir yıl dene.`;
        case "ratelimit": return "Platform istek sınırına ulaşıldı. Bir dakika sonra tekrar dene.";
        case "network": return "Platforma ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
        default: return null;
      }
    },
  });
})();
