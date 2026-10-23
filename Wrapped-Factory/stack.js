/* Kod Soruları Wrapped eklentisi: Stack Overflow herkese açık API'si (Stack Exchange API v2.3) */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { el, clamp, nf, pad, wait, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, SL } = K;
  const pct = (x) => Math.round(x * 100), API = "https://api.stackexchange.com/2.3";
  const TAGC = ["review", "open", "link", "closed", "#B58CFF", "#7FD962"];

  /* ---- veri katmanı ---- */
  async function se(path, params) {
    const u = new URL(API + path); u.searchParams.set("site", "stackoverflow"); for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
    let r; try { r = await fetch(u.toString()); } catch { throw mkErr("network"); }
    const j = await r.json().catch(() => null); if (!j) throw mkErr("network");
    if (j.error_id) throw mkErr([502, 503].includes(j.error_id) ? "ratelimit" : "http");
    if (j.backoff) await wait(Math.min(+j.backoff, 5) * 1000); return j;
  }
  async function pages(path, params, max) { const out = []; for (let p = 1; p <= max; p++) { const j = await se(path, { ...params, page: p, pagesize: 100 }); out.push(...(j.items || [])); if (!j.has_more) break; if (p === max) out.more = true; } return out; }
  async function load(input, ctx) {
    const id = input.id, year = ctx.year, from = Math.floor(Date.UTC(year, 0, 1) / 1000), to = Math.floor(Date.UTC(year + 1, 0, 1) / 1000), rng_ = { fromdate: from, todate: to };
    ctx.step("Profil alınıyor"); const u = ((await se(`/users/${id}`)).items || [])[0]; if (!u) throw mkErr("notfound");
    ctx.step("Cevaplar alınıyor"); const answers = await pages(`/users/${id}/answers`, { ...rng_, sort: "creation", order: "desc" }, 3);
    ctx.step("Sorular alınıyor"); const questions = await pages(`/users/${id}/questions`, { ...rng_, sort: "creation", order: "desc" }, 2);
    ctx.step("İtibar geçmişi alınıyor"); const rep = await pages(`/users/${id}/reputation-history`, rng_, 8);
    const ids = [...new Set(answers.map((a) => a.question_id))].slice(0, 300), qinfo = {};
    for (let i = 0; i < ids.length; i += 100) { ctx.step("Etiketler alınıyor"); for (const q of (await se(`/questions/${ids.slice(i, i + 100).join(";")}`, { pagesize: 100 })).items || []) qinfo[q.question_id] = { title: q.title, tags: q.tags || [] }; }
    return { year, user: { login: String(id), name: u.display_name, avatar: u.profile_image || null, id, reputation: u.reputation }, answers, questions, rep, qinfo, capped: !!(answers.more || questions.more || rep.more) };
  }
  /* ---- analiz ---- */
  function analyze(raw) {
    const year = raw.year, A = raw.answers, Q = raw.questions, ev = [...A.map((a) => a.creation_date * 1000), ...Q.map((q) => q.creation_date * 1000)];
    const W = { raw, year, user: { ...raw.user, handle: `#${raw.user.id}, ${nf.format(raw.user.reputation || 0)} itibar` }, partial: year === THIS_YEAR, nA: A.length, nQ: Q.length, nPosts: A.length + Q.length };
    const dc = {}; ev.forEach((t) => { const d = localISO(new Date(t)); dc[d] = (dc[d] || 0) + 1; });
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31); for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: dc[iso] || 0 }); }
    activity(W, { days: ev.length ? days : [], hourTimes: ev, minHours: 15 }); W.hoursNote = "Saatler gönderi zamanına göre ve bu cihazın saat dilimiyle gösterilir.";
    W.capped = !!raw.capped; W.gained = raw.rep.filter((r) => r.reputation_change > 0).reduce((s, r) => s + r.reputation_change, 0); W.lost = raw.rep.filter((r) => r.reputation_change < 0).reduce((s, r) => s - r.reputation_change, 0); W.net = W.gained - W.lost;
    W.acceptedRep = raw.rep.filter((r) => r.reputation_history_type === "answer_accepted").length; W.bounty = raw.rep.filter((r) => r.reputation_history_type === "bounty_earned").reduce((s, r) => s + r.reputation_change, 0);
    W.accepted = A.filter((a) => a.is_accepted).length; W.acceptRate = A.length ? W.accepted / A.length : 0; W.ansScore = A.reduce((s, a) => s + a.score, 0);
    const bestA = A.slice().sort((a, b) => b.score - a.score)[0]; W.best = bestA ? { score: bestA.score, title: (raw.qinfo[bestA.question_id] && raw.qinfo[bestA.question_id].title) || "Bir soru", date: localISO(new Date(bestA.creation_date * 1000)) } : null;
    const tg = {}; A.forEach((a) => ((raw.qinfo[a.question_id] || {}).tags || []).forEach((t) => { tg[t] = (tg[t] || 0) + 1; })); Q.forEach((q) => (q.tags || []).forEach((t) => { tg[t] = (tg[t] || 0) + 1; }));
    const tt = Object.values(tg).reduce((a, b) => a + b, 0) || 1; W.tags = Object.entries(tg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n], i) => ({ name, n, pct: (n / tt) * 100, color: TAGC[i] })); W.tagCount = Object.keys(tg).length; W.topTagShare = W.tags[0] ? W.tags[0].n / tt : 0;
    const nightS = W.nightShare || 0, o = [];
    if (A.length >= 40) o.push({ k: "Cevap Makinesi", w: A.length / 40, d: "Soru gelir, cevap gider.", why: `${nf.format(A.length)} cevap yazdın` });
    if (Q.length >= 10 && Q.length > A.length) o.push({ k: "Merak Sahibi", w: Q.length / Math.max(A.length, 5), d: "Her sorunun arkasında yeni bir şey öğreniyorsun.", why: `${nf.format(Q.length)} soru sordun` });
    if (A.length >= 10 && W.acceptRate >= 0.4) o.push({ k: "Kabul Avcısı", w: W.acceptRate / 0.4, d: "Cevapların tam isabet.", why: `Cevapların ${pcAcc(pct(W.acceptRate))} kabul edildi` });
    if (W.topTagShare >= 0.4) o.push({ k: "Etiket Ustası", w: W.topTagShare / 0.4, d: "Bir konunun uzmanısın.", why: `${W.tags[0].name} etiketi ${pcAcc(pct(W.topTagShare))} pay` });
    if (W.hours && nightS >= 0.25) o.push({ k: "Gece Cevaplayıcısı", w: nightS / 0.25, d: "Hata ayıklamak için gece en iyi zaman.", why: `Gönderilerinin ${pcAcc(pct(nightS))} gece 22–04 arası` });
    if (W.gained >= 2000) o.push({ k: "İtibar Koleksiyoncusu", w: W.gained / 2000, d: "Oylar sana akıyor.", why: `+${nf.format(W.gained)} itibar` });
    o.sort((a, b) => b.w - a.w); W.persona = o[0] || { k: "Sakin Katkıcı", d: "Sessiz ama istikrarlı bir katkı.", why: "Dengeli bir katkı" }; W.personaWhy = o.slice(0, 3).map((x) => x.why);
    const R = [], ad = (w, tag, t) => R.push({ w, tag, t });
    if (W.gained >= 1000) ad(W.gained / 1000, "itibar", `Bu yıl +${nf.format(W.gained)} itibar kazandın. Birileri sayende işe yetişti.`);
    if (W.best && W.best.score >= 10) ad(W.best.score / 10, "iyi", `En iyi cevabın ${W.best.score} oy aldı: "${W.best.title.slice(0, 60)}". İnsanlar minnettar.`);
    if (A.length >= 10 && W.acceptRate <= 0.15) ad(1.2, "kabul", `Cevapların yalnızca ${pcAcc(pct(W.acceptRate))} kabul edilmiş. Soranlar bazen teşekkür etmeyi unutuyor.`);
    if (W.hours && nightS >= 0.2) ad(nightS * 3, "gece", `Gönderilerinin ${pcAcc(pct(nightS))} gece 22 ile 04 arasında. Hata ayıklamak da bir uyku bozucu.`);
    if (W.topTagShare >= 0.45) ad(1.5, "etiket", `Gönderilerinin ${pcAcc(pct(W.topTagShare))} "${W.tags[0].name}" etiketinde. Başka dil var, haberin olsun.`);
    if (Q.length >= 10 && Q.length > A.length * 2) ad(1.3, "soru", `${nf.format(Q.length)} soru sordun, ${nf.format(A.length)} cevap yazdın. Sorular iyi, bir de cevap versen?`);
    if (W.busy && W.avgActive && W.busy.count / W.avgActive >= 4) ad(1, "gun", `${fmtDay(W.busy.date)} günü tek günde ${W.busy.count} gönderi. O gün ne yaşandı?`);
    R.sort((a, b) => b.w - a.w); const out = [], tgs = new Set(); for (const x of R) { if (out.length >= 3) break; if (!tgs.has(x.tag)) { tgs.add(x.tag); out.push(x.t); } }
    for (const f of ["Katkı geçmişin dengeli bir geliştirici portresi çiziyor.", "Bu yıl da toplulukla birlikte bir şeyler çözdün.", "Kopyala-yapıştır bile bir beceridir, sen yazanlardansın."]) { if (out.length >= 3) break; out.push(f); }
    W.roasts = out;
    finishCard(W, [["İTB", scoreK(W.gained, 500)], ["CVP", scoreK(A.length, 40)], ["KBL", 35 + 64 * clamp(W.acceptRate / 0.5, 0, 1)], ["SOR", scoreK(Q.length, 15)], ["ÇEŞ", scoreK(W.tagCount, 12)], ["GEC", 35 + 64 * clamp(nightS / 0.4, 0, 1)]]);
    W.poster = { blocks: [[`+${nf.format(W.gained)}`, "itibar", "open"], [nf.format(A.length), "cevap", "closed"], [nf.format(W.accepted), "kabul edilen", "review"], [nf.format(Q.length), "soru", "link"]], chips: W.tags.slice(0, 3).map((t) => ({ name: t.name, color: t.color })), waffle: W.tags.map((t) => ({ pct: t.pct, color: t.color })) };
    if (W.tags.length >= 3) W.wordsCard = { name: "Etiketler", title: "En çok yazdığın etiketler", words: W.tags.map((t) => ({ w: t.name, n: t.n })), lines: [`En çok: ${W.tags[0].name} (${W.tags[0].n} gönderi).`, `${W.tagCount} farklı etiketle çalıştın.`] };
    return W;
  }

  /* ---- slaytlar ---- */
  const repSlide = (W) => ({ t: "t-link", r(root) {
    const n = big("0", 46); root.append(say("Bu yıl kazandığın itibar"), n, say("puan."), say(`${W.lost ? `${nf.format(W.lost)} puan kaybettin, net ${W.net >= 0 ? "+" : "−"}${nf.format(Math.abs(W.net))}. ` : ""}${W.acceptedRep ? `${nf.format(W.acceptedRep)} cevabın kabul edildi.` : ""}${W.bounty ? ` Ödül kazancı: ${nf.format(W.bounty)}.` : ""}`, true), W.capped ? say("Çok aktif bir hesap: en son 300 cevap, 200 soru ve 800 itibar olayı okundu. Gerçek değerler bunlardan yüksek olabilir.", true) : el("span")); countUp(n, W.gained, (v) => `+${nf.format(v)}`);
  } });
  const answerSlide = (W) => ({ t: "t-closed", r(root) {
    const n = big("0", 46), mx = Math.max(W.nA, W.nQ, 1); root.append(say("Yazdığın cevap"), n, say(`${nf.format(W.accepted)} tanesi kabul edildi (%${pct(W.acceptRate)}). Toplam ${nf.format(W.ansScore)} oy aldın.`), el("div", "grow")); countUp(n, W.nA);
    const rows = el("div", "cmp"); [["Cevap", W.nA, "now"], ["Soru", W.nQ, "prev"]].forEach(([lab, v, cls]) => { const r = el("div", "cmp-row"); r.append(el("span", "", lab), el("b", "", nf.format(v))); const bar = el("i", "cmp-bar " + cls); bar.dataset.w = Math.max(Math.round((v / mx) * 100), 2); r.append(bar); rows.append(r); });
    root.append(rows); after(() => rows.querySelectorAll(".cmp-bar").forEach((b) => { b.style.width = b.dataset.w + "%"; }));
  } });
  const tagSlide = (W) => ({ t: "t-ink", dur: 7.5, r(root) {
    const t = W.tags, mx = t[0].n; root.append(say("En çok yazdığın etiket"), big(t[0].name, 20), say(`Gönderilerinin %${pct(W.topTagShare)} kadarı bu etikette.`, true), el("div", "grow"));
    K.gfx.rankBars(root, t.slice(0, 5).map((x, i) => ({ label: x.name, text: `${x.n} gönderi`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const bestSlide = (W) => ({ t: "t-open", dur: 7, r(root) {
    const n = big("0", 46), t = say(`"${W.best.title}"`); t.style.cssText = "display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden"; root.append(say("En çok oylanan cevabın"), n, say("oy aldı."), t, say(fmtDay(W.best.date), true)); countUp(n, W.best.score);
  } });
  function duelRounds(A, B) {
    const R = [], add = (id, label, a, b, fmt) => { R.push({ id, label, a, b, fmt: fmt || ((v) => nf.format(v)), win: a > b ? "a" : b > a ? "b" : "t" }); };
    add("rep", "Kazanılan itibar", A.gained, B.gained, (v) => `+${nf.format(v)}`); add("answers", "Cevap sayısı", A.nA, B.nA); add("accepted", "Kabul edilen", A.accepted, B.accepted); add("questions", "Soru sayısı", A.nQ, B.nQ); add("tags", "Etiket çeşitliliği", A.tagCount, B.tagCount); add("power", "Kod kartı gücü", A.overall, B.overall);
    return R;
  }
  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const BRACE = svg('<path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2"/>', "none");
  const ICON_SET = { "Cevap Makinesi": svg('<path d="M13.6 1.8 4.4 13.6h6.4l-1.1 8.6 9.9-12.2h-6.5z"/>'), "Merak Sahibi": svg('<circle cx="12" cy="12" r="9"/><path d="M9.500 9a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 .900-1 1.700M12 17h.01"/>', "none"), "Kabul Avcısı": svg('<path d="m4 12 5 5L20 6"/>', "none"), "Etiket Ustası": svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.200" fill="#000"/>'), "Gece Cevaplayıcısı": svg('<path d="M20.600 14.400A9 9 0 0 1 9.600 3.400a9 9 0 1 0 11 11z"/>'), "İtibar Koleksiyoncusu": svg('<path d="M12 2l2.500 6.500L21 9l-5 4.500L17.500 21 12 17.200 6.500 21 8 13.500 3 9l6.500-.500z"/>'), "Sakin Katkıcı": BRACE };
  ICON_SET.default = BRACE;
  const parseId = (s) => { s = String(s || "").trim(); const m = /\/users\/(\d+)/.exec(s) || /^#?(\d{1,9})$/.exec(s); return m ? m[1] : null; };

  Wrapped.register({
    id: "stack", name: "Kod Soruları Wrapped", brand: "Kod Soruları Wrapped", icon: BRACE, blurb: "Stack Overflow'daki yılın: itibar, etiketler, kabul edilen cevaplar.", hashtags: "#KodSoruları #StackOverflow #Yazılım",
    theme: { id: "code", skin: "code", motif: "code", wipe: "scan", css: "theme-code.css", display: '"JetBrains Mono","Consolas",monospace', fontCheck: ['800 80px "JetBrains Mono"'],
      colors: { merge: "#1B2735", open: "#F48024", closed: "#0A7D5A", review: "#FDE68A", link: "#0074CC", ink: "#0B0F14", paper: "#F1F5F9" },
      fg: { merge: "#E8EEF5", open: "#1A0F05", closed: "#E9FFF6", review: "#1F1A05", link: "#F2F9FF", ink: "#E8EEF5" } },
    input: { kind: "user", label: "Stack Overflow profil bağlantısı ya da numarası", placeholder: "profil bağlantısı ya da kullanıcı numarası", rivalPlaceholder: "rakibin profil bağlantısı ya da numarası", years: true, duel: true, at: "#" },
    icons: ICON_SET, duelHighlights: ["rep", "answers", "accepted", "power"],
    vocab: { noun: "gönderi", plPoss: "gönderilerinin", doVerb: "yazdın", doVerb1: "yazdım", activeVerb: "soru ya da cevap yazdın", weekdayVerb: "cevap yazıyorsun", night: "Gece cevaplayıcısısın.", morning: "Sabah cevaplayıcısısın.", evening: "Akşam cevaplayıcısısın.", day: "Mesai cevaplayıcısısın.", hoursLead: "En çok yazdığın saat", busyLead: "En yoğun günün",
      streakLine: "gün üst üste yazdın", streakLine1: "gün üst üste yazdım", skyTitle: "Kod şehrin", skyCard: "kod şehrim", introTail: "soru-cevap yılın", introTail1: "soru-cevap yılım", personaLead: "Geliştirici kişiliğin", personaLead1: "Geliştirici kişiliğim", cardLead: "Kod kartın hazır.", cardLead1: "Kod kartım", cardWho: "olarak yardım ediyorsun", devName: "Kod kartı" },
    makeInput(v) { const id = parseId(v.user); if (!id) return { error: "Kullanıcı adı yerine profil bağlantısını ya da sayısal numarayı yaz (örn. stackoverflow.com/users/22656/jon-skeet)." }; return { id, user: id, label: `#${id}`, query: { u: id } }; },
    fromQuery(q) { const u = q.get("u"); if (!u || q.get("s") !== "stack") return null; const v = q.get("v"); return { input: { id: u, user: u, label: "#" + u, query: { u } }, rival: v ? { id: v, user: v, label: "#" + v, query: { u: v } } : null, year: +q.get("y") }; },
    load, analyze, isEmpty: (W) => W.nPosts < 3 && W.gained === 0,
    slides(W) {
      const sf = (n) => Wrapped.kit.sceneFor(W, n);
      const L = [SL.intro(W)], a = W.hasCal && W.total > 0 ? SL.activity(W) : [];
      if (a.length) L.push(a[0]); L.push(...[sf("terminal")].filter(Boolean), repSlide(W)); if (W.nA) L.push(answerSlide(W)); if (W.accepted >= 3) L.push(...[sf("accepted")].filter(Boolean)); if (W.tags.length >= 2) L.push(tagSlide(W)); if (W.best && W.best.score >= 3) L.push(bestSlide(W));
      L.push(...a.slice(1)); if (W.hours) L.push(SL.hours(W)); if (a.length) L.push(SL.skyline(W)); L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W)); return L;
    },
    duelRounds,
    caption(W, url) { return `${W.year} Kod Soruları Wrapped'ım 💻\n+${nf.format(W.gained)} itibar · ${nf.format(W.nA)} cevap · ${W.persona.k}\nKod kartım: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#KodSoruları #StackOverflow #${W.year}`; },
    errMsg(e, who) { if (e.code === "notfound") return `${who} numaralı bir Stack Overflow kullanıcısı bulunamadı.`; if (e.code === "empty") return `${who} için seçilen yılda yeterli gönderi bulunamadı. Başka bir yıl dene.`; if (e.code === "ratelimit") return "Stack Exchange günlük istek sınırına ulaşıldı. Daha sonra tekrar dene."; if (e.code === "network") return "Stack Exchange'e ulaşılamadı. Bağlantını kontrol edip tekrar dene."; return null; },
  });
})();
