/* Takım Wrapped eklentisi: bir GitHub organizasyonunun ya da deposunun yılı */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { el, clamp, nf, pad, wait, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, avatarNode, SL } = K;
  const pct = (x) => Math.round(x * 100), MEDAL = ["#F5C242", "#C9D1D9", "#CD7F32"];
  let TOKEN = "";

  /* =====================================================
     Veri katmanı
  ===================================================== */
  async function gh(path) {
    const h = { Accept: "application/vnd.github+json" }; if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
    let r; try { r = await fetch("https://api.github.com" + path, { headers: h }); } catch { throw mkErr("network"); }
    if (r.status === 404) throw mkErr("notfound"); if (r.status === 409) return [];
    if (r.status === 401) throw mkErr("badtoken");
    if (r.status === 403 || r.status === 429) { const rem = r.headers.get("x-ratelimit-remaining"); if (rem === "0" || r.status === 429) { const rs = +r.headers.get("x-ratelimit-reset"); throw mkErr("ratelimit", rs ? rs * 1000 : null); } throw mkErr("http", 403); }
    if (!r.ok) throw mkErr("http", r.status); return r.json();
  }
  async function load(input, ctx) {
    TOKEN = ctx.token || ""; const year = ctx.year, since = `${year}-01-01T00:00:00Z`, until = `${year + 1}-01-01T00:00:00Z`, [owner, only] = input.target.split("/");
    ctx.step("Takım bilgisi alınıyor"); let repos, avatar = null, kind = "org", name = owner;
    if (only) { const r = await gh(`/repos/${owner}/${only}`); repos = [r]; avatar = r.owner && r.owner.avatar_url; name = `${owner}/${only}`; kind = "repo"; }
    else {
      let info; try { info = await gh(`/orgs/${owner}`); } catch (e) { if (e.code !== "notfound") throw e; info = await gh(`/users/${owner}`); kind = "user"; }
      avatar = info.avatar_url; name = info.name || info.login || owner;
      repos = await gh(`/${kind === "org" ? "orgs" : "users"}/${owner}/repos?per_page=100&sort=pushed&type=owner`.replace("type=owner", kind === "org" ? "type=public" : "type=owner"));
      repos = repos.filter((r) => !r.fork && !r.archived && r.pushed_at && new Date(r.pushed_at).getFullYear() >= year).slice(0, 6);
    }
    const commits = [];
    for (let k = 0; k < repos.length; k++) {
      const r = repos[k]; ctx.step(`${r.name} commitleri (${k + 1}/${repos.length})`);
      for (let page = 1; page <= 3; page++) {
        const rows = await gh(`/repos/${r.full_name || owner + "/" + r.name}/commits?since=${since}&until=${until}&per_page=100&page=${page}`);
        for (const c of rows) { const who = (c.author && c.author.login) || (c.commit && c.commit.author && c.commit.author.name) || "?"; commits.push({ r: r.name, who, avatar: (c.author && c.author.avatar_url) || null, d: c.commit.author.date, m: String((c.commit && c.commit.message) || "").split("\n")[0] }); }
        if (rows.length < 100) break;
      }
    }
    return { year, owner, kind, avatar, name, repos: repos.map((r) => ({ name: r.name, stars: r.stargazers_count || 0 })), commits };
  }
  /* =====================================================
     Analiz
  ===================================================== */
  function analyze(raw) {
    const year = raw.year, cs = raw.commits.filter((c) => !/\[bot\]$/i.test(c.who) && new Date(c.d).getFullYear() === year);
    const W = { raw, year, commits: cs, user: { login: raw.owner, name: raw.name, avatar: raw.avatar, handle: "" }, partial: year === THIS_YEAR, nCommits: cs.length };
    const dc = {}; cs.forEach((c) => { const d = localISO(new Date(c.d)); dc[d] = (dc[d] || 0) + 1; });
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31); for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: dc[iso] || 0 }); }
    activity(W, { days: cs.length ? days : [], hourTimes: cs.map((c) => c.d), minHours: 20 }); W.hoursNote = "Saatler commit zamanına göre ve bu cihazın saat dilimiyle gösterilir.";
    const P = {}; cs.forEach((c) => { const p = (P[c.who] = P[c.who] || { name: c.who, avatar: c.avatar, n: 0, days: new Set(), repos: new Set(), night: 0, morning: 0, weekend: 0, len: 0 }); const d = new Date(c.d), h = d.getHours(), wd = (d.getDay() + 6) % 7; p.n++; p.days.add(localISO(d)); p.repos.add(c.r); if (h >= 22 || h < 4) p.night++; if (h >= 5 && h < 10) p.morning++; if (wd >= 5) p.weekend++; p.len += c.m.length; if (c.avatar && !p.avatar) p.avatar = c.avatar; });
    W.people = Object.values(P).map((p) => { const ds = [...p.days].sort(); let bs = 0, cur = 0, prev = null; for (const d of ds) { const dt = new Date(d + "T00:00:00"); cur = prev && (dt - prev) / 864e5 === 1 ? cur + 1 : 1; bs = Math.max(bs, cur); prev = dt; } return { ...p, activeDays: ds.length, repoCount: p.repos.size, streak: bs, nightShare: p.night / p.n, morningShare: p.morning / p.n, weekendShare: p.weekend / p.n, avgLen: p.len / p.n }; }).sort((a, b) => b.n - a.n);
    W.user.handle = `${W.people.length} katkıcı, ${raw.repos.length} depo`;
    const rp = {}; cs.forEach((c) => { rp[c.r] = (rp[c.r] || 0) + 1; }); W.repos = Object.entries(rp).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n })); W.repoCount = Object.keys(rp).length;
    const top = W.people[0], topShare = top ? top.n / Math.max(cs.length, 1) : 0, A = [], add = (k, p, v) => { if (p) A.push({ k, who: p.name, v }); };
    add("MVP", top, top && `${nf.format(top.n)} commit`);
    const big_ = (arr, f, min) => arr.filter((p) => f(p) >= min).sort((a, b) => f(b) - f(a))[0], many = W.people.filter((p) => p.n >= 10);
    const ng = big_(many, (p) => p.nightShare, 0.15); add("Gece Kuşu", ng, ng && `%${pct(ng.nightShare)} gece commiti`);
    const mn = big_(many, (p) => p.morningShare, 0.25); add("Sabahçı", mn, mn && `%${pct(mn.morningShare)} sabah commiti`);
    const wk = big_(many, (p) => p.weekendShare, 0.2); add("Hafta Sonu Savaşçısı", wk, wk && `%${pct(wk.weekendShare)} hafta sonu`);
    const sk = big_(W.people, (p) => p.streak, 4); add("Seri Katili", sk, sk && `${sk.streak} gün üst üste`);
    const po = big_(many, (p) => p.avgLen, 28); add("Mesaj Şairi", po, po && `ortalama ${Math.round(po.avgLen)} karakter`);
    const mv = big_(W.people, (p) => p.repoCount, 2); add("Çok Yönlü", mv, mv && `${mv.repoCount} depoda`);
    W.awards = A.filter((a, i, arr) => arr.findIndex((x) => x.k === a.k) === i).slice(0, 6);
    const night = W.nightShare || 0, wkd = W.weekendShare || 0, o = [];
    if (topShare >= 0.6 && W.people.length >= 2) o.push({ k: "Tek Kişilik Ordu", w: topShare / 0.6, d: "Birisi her işi omuzlamış.", why: `Commitlerin ${pcAcc(pct(topShare))} tek kişiden` });
    if (topShare <= 0.35 && W.people.length >= 4) o.push({ k: "Dengeli Takım", w: 0.35 / Math.max(topShare, 0.1), d: "İş herkese adil dağılmış.", why: `En çok commit atan bile ${pcAcc(pct(topShare))} payda` });
    if (W.hours && night >= 0.25) o.push({ k: "Gece Vardiyası", w: night / 0.25, d: "Ekip gece mesaisine bayılıyor.", why: `Commitlerin ${pcAcc(pct(night))} gece 22–04 arası` });
    if (wkd >= 0.3) o.push({ k: "Hafta Sonu Takımı", w: wkd / 0.3, d: "Tatil günleri de takım için çalışıyor.", why: `Commitlerin ${pcAcc(pct(wkd))} hafta sonu` });
    if (W.best.len >= 30) o.push({ k: "Maraton Ekibi", w: W.best.len / 30, d: "Bir gün bile ara vermiyorlar.", why: `${W.best.len} günlük kesintisiz seri` });
    if (W.hours && (W.morningShare || 0) >= 0.3) o.push({ k: "Sabah Ekibi", w: W.morningShare / 0.3, d: "Güne commit ile başlıyorlar.", why: `Commitlerin ${pcAcc(pct(W.morningShare))} sabah` });
    o.sort((a, b) => b.w - a.w); W.persona = o[0] || { k: "Uyumlu Ekip", d: "Ritmi oturmuş, istikrarlı bir takım.", why: "Dengeli bir tempo" }; W.personaWhy = o.slice(0, 3).map((x) => x.why);
    const R = [], ad = (w, tag, t) => R.push({ w, tag, t });
    if (top && W.people.length >= 2 && topShare >= 0.5) ad(topShare * 3, "pay", `${top.name}, commitlerin ${pcAcc(pct(topShare))} tek başına attı. Diğerleri izleyici koltuğunda mı?`);
    if (W.hours && night >= 0.2) ad(night * 3, "gece", `Commitlerin ${pcAcc(pct(night))} gece 22 ile 04 arasında. Ofis ışıkları hiç mi sönmüyor?`);
    if (W.busy && W.avgActive && W.busy.count / W.avgActive >= 5) ad(1.5, "zirve", `${fmtDay(W.busy.date)} günü tek günde ${W.busy.count} commit. Teslim tarihi miydi, panik miydi?`);
    if (wkd >= 0.25) ad(wkd * 3, "haftasonu", `Commitlerin ${pcAcc(pct(wkd))} hafta sonu. Bu takıma tatil günü öğretilmemiş.`);
    const wip = cs.filter((c) => /^(wip|fix|update|test)$/i.test(c.m.trim())).length; if (wip >= 10) ad(1.2, "mesaj", `${wip} commit mesajı yalnızca "wip", "fix", "update" ya da "test". Mesaj yazmak için ödül veririz.`);
    if (W.gap && W.gap.len >= 14) ad(W.gap.len / 14, "ara", `${W.gap.len} gün hiç commit yok. Toplu tatil miydi?`);
    R.sort((a, b) => b.w - a.w); const out = [], tg = new Set(); for (const x of R) { if (out.length >= 3) break; if (!tg.has(x.tag)) { tg.add(x.tag); out.push(x.t); } }
    for (const f of ["Commit geçmişiniz iyi bir ekip portresi çiziyor.", "Birlikte yazdığınız kod, birlikte büyüdüğünüzü gösteriyor.", "Bu yıl da deponuz boş kalmadı."]) { if (out.length >= 3) break; out.push(f); }
    W.roasts = out;
    const perDay = W.active ? cs.length / W.active : 0;
    finishCard(W, [["TMP", scoreK(perDay, 6)], ["UYM", 35 + 64 * clamp(1 - topShare + 0.1, 0, 1)], ["GEC", 35 + 64 * clamp(night / 0.4, 0, 1)], ["SER", scoreK(W.best.len, 25)], ["ÇEŞ", scoreK(W.repoCount, 4)], ["KTL", scoreK(W.people.length, 6)]]);
    W.poster = { blocks: [[nf.format(cs.length), "commit", "open"], [String(W.people.length), "katkıcı", "closed"], [String(W.repoCount), "depo", "review"], [String(W.best.len), "gün üst üste", "link"]], chips: W.people.slice(0, 3).map((p, i) => ({ name: p.name, color: MEDAL[i] })), waffle: W.people.slice(0, 6).map((p, i) => ({ pct: (p.n / Math.max(cs.length, 1)) * 100, color: ["review", "open", "link", "closed", "#B58CFF", "#7FD962"][i] })) };
    return W;
  }

  /* ---- slaytlar ---- */
  const podiumSlide = (W) => ({ t: "t-review", dur: 8, r(root) {
    const p = W.people.slice(0, 3), order = [1, 0, 2].filter((i) => p[i]), mx = p[0].n, heights = [100, 74, 56];
    root.append(say("Podyum"), say(`${p[0].name}, ${nf.format(p[0].n)} commit ile zirvede.`, true), el("div", "grow"));
    const pod = el("div", "podium");
    order.forEach((i) => { const col = el("div", "pod"), a = avatarNode({ user: { avatar: p[i].avatar, name: p[i].name, login: p[i].name } }, "pod-av"), bar = el("div", "pod-bar", String(i + 1)); bar.dataset.h = [34, 26, 20][i]; col.append(a, el("b", "", p[i].name), el("span", "", `${nf.format(p[i].n)} commit`), bar); pod.append(col); });
    root.append(pod); after(() => pod.querySelectorAll(".pod-bar").forEach((b) => { b.style.height = b.dataset.h + "cqh"; }));
  } });
  const boardSlide = (W) => ({ t: "t-link", dur: 7.5, r(root) {
    const pp = W.people.slice(0, 6), mx = pp[0].n; root.append(say("Liderlik tablosu"), say(`${W.people.length} katkıcı, toplam ${nf.format(W.nCommits)} commit.`, true), el("div", "grow"));
    K.gfx.rankBars(root, pp.map((x, i) => ({ label: x.name, text: `${nf.format(x.n)} commit, ${x.activeDays} gün`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const repoSlide = (W) => ({ t: "t-closed", dur: 7.5, r(root) {
    const r = W.repos, mx = r[0].n; root.append(say("En çok commit alan depo"), big(r[0].name, 18), say(`${nf.format(r[0].n)} commit, takımın %${pct(r[0].n / W.nCommits)} kadarı.`, true), el("div", "grow"));
    K.gfx.rankBars(root, r.map((x, i) => ({ label: x.name, text: `${nf.format(x.n)} commit`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const awardsSlide = (W) => ({ t: "t-open", dur: 9, r(root) {
    root.append(say("Takım ödülleri"), say("Bu yılın ödülleri sahiplerini buldu.", true), el("div", "grow"));
    const g = el("div", "awards"); W.awards.forEach((a) => { const c = el("div", "award"); c.append(el("b", "", a.k), el("span", "", a.who), el("small", "", a.v)); g.append(c); }); root.append(g, el("div", "grow"));
  } });
  async function drawPodiumCard(S) {
    const C = K.cards, PL = K.PAL, FG = K.FGC; await C.prepCards(S); const { cv, c } = C.newCard(PL.ink); C.deco(c, S, FG.ink, 0.08); C.head(c, S, FG.ink);
    C.stretch(c, "expanded"); c.fillStyle = FG.ink; const fs = C.fitFont(c, "PODYUM", 936, 150, 900); c.font = `900 ${fs}px ${C.DISP}`; c.fillText("PODYUM", C.CM - 4, 470);
    const p = S.people.slice(0, 3), order = [1, 0, 2].filter((i) => p[i]), base = 1500, w = 290, gap = 22, x0 = (C.CW - (order.length * w + (order.length - 1) * gap)) / 2, hs = [620, 470, 360], mx = p[0].n;
    order.forEach((i, k) => {
      const x = x0 + k * (w + gap), h = Math.round(hs[i] * (0.6 + 0.4 * (p[i].n / mx)));
      c.fillStyle = MEDAL[i]; C.rr(c, x, base - h, w, h, 14); c.fillStyle = PL.ink; C.stretch(c, "expanded"); c.font = `900 120px ${C.DISP}`; c.textAlign = "center"; c.fillText(String(i + 1), x + w / 2, base - h + 140);
      c.fillStyle = FG.ink; C.stretch(c, "normal"); let nm = p[i].name; c.font = `800 44px ${C.SANS}`; while (c.measureText(nm).width > w && nm.length > 4) nm = nm.slice(0, -2); c.fillText(nm === p[i].name ? nm : nm + "…", x + w / 2, base - h - 70); c.font = `700 34px ${C.SANS}`; c.globalAlpha = 0.85; c.fillText(`${nf.format(p[i].n)} commit`, x + w / 2, base - h - 26); c.globalAlpha = 1; c.textAlign = "left";
    });
    C.foot(c, FG.ink); return cv;
  }
  function duelRounds(A, B) {
    const R = [], add = (id, label, a, b, fmt) => { if (a == null || b == null) return; R.push({ id, label, a, b, fmt: fmt || ((v) => nf.format(v)), win: a > b ? "a" : b > a ? "b" : "t" }); };
    add("commits", "Toplam commit", A.nCommits, B.nCommits); add("people", "Katkıcı sayısı", A.people.length, B.people.length); add("active", "Aktif gün", A.active, B.active); add("streak", "En uzun seri", A.best.len, B.best.len, (v) => `${v} gün`);
    add("repos", "Aktif depo", A.repoCount, B.repoCount); if (A.hours && B.hours) add("night", "Gece commitleri", pct(A.nightShare), pct(B.nightShare), (v) => `%${v}`); add("power", "Takım kartı gücü", A.overall, B.overall);
    return R;
  }
  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const TROPHY = svg('<path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8"/>', "none");
  const ICON_SET = { "Tek Kişilik Ordu": svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>'), "Dengeli Takım": svg('<circle cx="7" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><circle cx="12" cy="15" r="3"/>'), "Gece Vardiyası": svg('<path d="M20.6 14.4A9 9 0 0 1 9.6 3.4a9 9 0 1 0 11 11z"/>'), "Hafta Sonu Takımı": svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', "none"), "Maraton Ekibi": svg('<path d="M5 2.5h2v19H5zM8 4h11l-3 4.500L19 13H8z"/>'), "Sabah Ekibi": svg('<circle cx="12" cy="12" r="4.4"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4"/>', "none"), "Uyumlu Ekip": TROPHY };
  ICON_SET.default = TROPHY;
  const parseTarget = (s) => { let t = String(s || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/^@/, "").replace(/[?#].*$/, "").replace(/\/+$/, ""); const p = t.split("/").filter(Boolean); return p.slice(0, 2).join("/"); };

  Wrapped.register({
    id: "team", name: "Takım Wrapped", brand: "Takım Wrapped", icon: TROPHY, blurb: "Ekibinin ya da kulübünün yılı: podyum, ödüller.", hashtags: "#TakımWrapped #GitHub #YazılımTakımı",
    theme: { id: "team", skin: "team", motif: "stripes", wipe: "curtain", css: "theme-team.css", display: '"Oswald","Impact","Arial Narrow",sans-serif', fontCheck: ['700 80px "Oswald"'],
      colors: { merge: "#1D4ED8", open: "#F59E0B", closed: "#DC2626", review: "#E5E7EB", link: "#0E7490", ink: "#0B1220", paper: "#F3F4F6" },
      fg: { merge: "#FFFFFF", open: "#111827", closed: "#FFFFFF", review: "#111827", link: "#FFFFFF", ink: "#F3F4F6" } },
    input: { kind: "user", label: "GitHub organizasyonu ya da depo", placeholder: "organizasyon ya da sahip/depo", rivalPlaceholder: "rakip takım (organizasyon ya da sahip/depo)", years: true, duel: true, token: true, at: "gh/" },
    icons: ICON_SET, duelHighlights: ["commits", "people", "streak", "power"],
    vocab: { noun: "commit", plPoss: "commitlerinizin", doVerb: "attınız", doVerb1: "attık", activeVerb: "kod yazdınız", noBreak: "hiç ara vermediniz", dayPoss: "gününüzün", weekdayVerb: "kod yazıyorsunuz", night: "Gece vardiyası ekibisiniz.", morning: "Sabah ekibisiniz.", evening: "Akşam ekibisiniz.", day: "Mesai ekibisiniz.", hoursLead: "En verimli saatiniz",
      busyLead: "En yoğun gününüz", streakLead: "En uzun serimiz", streakLead1: "En uzun serimiz", curStreak: "Şu an aktif serimiz", streakLine: "gün üst üste commit attınız", streakLine1: "gün üst üste commit attık", skyLead: "Takımınız bir şehir olsaydı", skyTitle: "Takım şehriniz", skyCard: "takım şehrimiz", skyName: "Takım şehri", introTail: "takım yılınız", introTail1: "takım yılımız", personaLead: "Takım kişiliğiniz", personaLead1: "Takım kişiliğimiz", cardLead: "Takım kartınız hazır.", cardLead1: "Takım kartımız", cardWho: "olarak çalışıyorsunuz", devName: "Takım kartı" },
    makeInput(v) { const t = parseTarget(v.user); const parts = t.split("/"); if (!t || !parts.every((x) => /^[A-Za-z0-9_.-]{1,100}$/.test(x))) return { error: "Geçerli bir organizasyon adı ya da sahip/depo yaz (örn. vercel ya da vercel/next.js)." }; return { target: t, label: t, user: t, query: { t } }; },
    fromQuery(q) { const t = q.get("t"); if (!t || q.get("s") !== "team") return null; const v = q.get("v"); return { input: { target: t, user: t, label: t, query: { t } }, rival: v ? { target: v, user: v, label: v, query: { t: v } } : null, year: +q.get("y") }; },
    load, analyze, isEmpty: (W) => W.nCommits < 10,
    slides(W) {
      const sf = (n) => Wrapped.kit.sceneFor(W, n);
      const L = [SL.intro(W), ...[sf("flip")].filter(Boolean)]; if (W.hasCal && W.total > 0) { const a = SL.activity(W); L.push(a[0]); }
      L.push(podiumSlide(W)); if (W.people.length >= 3) L.push(sf("race") || boardSlide(W));
      if (W.hasCal && W.total > 0) L.push(...SL.activity(W).slice(1));
      if (W.repos.length >= 2) L.push(repoSlide(W)); if (W.awards.length >= 3) L.push(awardsSlide(W));
      if (W.hours) L.push(SL.hours(W)); if (W.hasCal && W.total > 0) L.push(SL.skyline(W));
      L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W)); return L;
    },
    extraCards(S) { return [["podium", "Podyum", drawPodiumCard, S.people.length >= 2]]; },
    duelRounds,
    caption(W, url) { return `${W.year} Takım Wrapped 🏆\n${nf.format(W.nCommits)} commit · ${W.people.length} katkıcı · ${W.persona.k}\nTakım kartı: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#TakımWrapped #GitHub #${W.year}`; },
    errMsg(e, who) {
      switch (e.code) {
        case "notfound": return `"${who}" adında bir organizasyon ya da depo bulunamadı.`; case "empty": return `${who} için seçilen yılda yeterli herkese açık commit bulunamadı. Başka bir yıl ya da başka bir depo dene.`; case "badtoken": return "Token geçersiz görünüyor. Boş bırakıp tekrar dene.";
        case "ratelimit": return `GitHub istek sınırına ulaşıldı.${e.extra ? ` ${new Date(e.extra).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} sonra tekrar dene` : " Biraz sonra tekrar dene"} ya da aşağıdan kendi token'ını ekle.`; case "network": return "GitHub'a ulaşılamadı. Bağlantını kontrol edip tekrar dene."; default: return null;
      }
    },
  });
})();
