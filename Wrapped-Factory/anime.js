/* Anime Wrapped eklentisi: AniList herkese açık listesi (GraphQL) */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { el, clamp, nf, pad, wait, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, SL, MONTHS } = K;
  const pct = (x) => Math.round(x * 100), avgOf = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const FORMAT_TR = { TV: "TV dizisi", TV_SHORT: "Kısa dizi", MOVIE: "Film", OVA: "OVA", ONA: "ONA", SPECIAL: "Özel", MUSIC: "Müzik" };
  const GENRE_TR = { Action: "Aksiyon", Adventure: "Macera", Comedy: "Komedi", Drama: "Dram", Fantasy: "Fantastik", Horror: "Korku", "Mahou Shoujo": "Büyülü Kız", Mecha: "Mecha", Music: "Müzik", Mystery: "Gizem", Psychological: "Psikolojik", Romance: "Romantik", "Sci-Fi": "Bilim Kurgu", "Slice of Life": "Günlük Yaşam", Sports: "Spor", Supernatural: "Doğaüstü", Thriller: "Gerilim", Ecchi: "Ecchi", Hentai: "Yetişkin" };
  const gTr = (g) => GENRE_TR[g] || g;
  const GCOL = ["#FF3D8B", "#00D1FF", "#FFD60A", "#7C3AED", "#FF7A00", "#2FD1A4", "#B58CFF", "#9AA3B2"];

  /* =====================================================
     Veri katmanı
  ===================================================== */
  const QUERY = `query($name:String){
    User(name:$name){ id name avatar{large} }
    MediaListCollection(userName:$name, type:ANIME, status:COMPLETED){ lists{ entries{ score(format:POINT_100) repeat progress completedAt{year month day}
      media{ id title{romaji english} format episodes duration genres seasonYear studios(isMain:true){nodes{name}} } } } } }`;
  async function load(input, ctx) {
    ctx.step("AniList listesi alınıyor");
    let r; try { r = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: QUERY, variables: { name: input.user } }) }); } catch { throw mkErr("network"); }
    if (r.status === 404) throw mkErr("notfound"); if (r.status === 429) throw mkErr("ratelimit", Date.now() + 60000);
    const j = await r.json().catch(() => null); if (!j) throw mkErr("network");
    if (j.errors && !j.data) throw mkErr(j.errors.some((e) => e.status === 404 || /not found/i.test(e.message)) ? "notfound" : "http");
    const u = j.data && j.data.User; if (!u) throw mkErr("notfound");
    const seen = new Set(), entries = [];
    for (const l of (j.data.MediaListCollection && j.data.MediaListCollection.lists) || []) for (const e of l.entries || []) {
      const m = e.media; if (!m || seen.has(m.id)) continue; seen.add(m.id);
      const c = e.completedAt || {}; if (!c.year || !c.month || !c.day) continue;
      const eps = e.progress || m.episodes || 1;
      entries.push({ id: m.id, title: (m.title && (m.title.english || m.title.romaji)) || "?", format: m.format || "TV", eps, min: eps * (m.duration || 24), genres: m.genres || [], studio: (m.studios && m.studios.nodes && m.studios.nodes[0] && m.studios.nodes[0].name) || null, score: e.score || 0, date: `${c.year}-${pad(c.month)}-${pad(c.day)}`, seasonYear: m.seasonYear || null, repeat: e.repeat || 0 });
    }
    return { year: ctx.year, user: { login: u.name, name: u.name, avatar: (u.avatar && u.avatar.large) || null }, entries };
  }
  /* =====================================================
     Analiz
  ===================================================== */
  function analyze(raw) {
    const year = raw.year, es = raw.entries.filter((e) => +e.date.slice(0, 4) === year).sort((a, b) => (a.date < b.date ? -1 : 1));
    const W = { raw, year, entries: es, user: { ...raw.user, handle: "@" + raw.user.login }, partial: year === THIS_YEAR, nAnime: es.length };
    const dc = {}; es.forEach((e) => { dc[e.date] = (dc[e.date] || 0) + e.eps; });
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31); for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: dc[iso] || 0 }); }
    activity(W, { days: es.length ? days : [], hourTimes: [] });
    W.episodes = es.reduce((s, e) => s + e.eps, 0); W.minutes = es.reduce((s, e) => s + e.min, 0); W.hours = null; W.hoursTotal = W.minutes / 60;
    const scored = es.filter((e) => e.score > 0); W.meanScore = scored.length ? avgOf(scored.map((e) => e.score)) / 10 : null; W.rated = scored.length;
    const gm = {}; es.forEach((e) => e.genres.forEach((g) => { gm[g] = (gm[g] || 0) + e.min / Math.max(e.genres.length, 1); })); const gt = Object.values(gm).reduce((a, b) => a + b, 0) || 1;
    W.genres = Object.entries(gm).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, v], i) => ({ name: gTr(g), key: g, pct: (v / gt) * 100, color: GCOL[i % GCOL.length] })); W.genreCount = Object.values(gm).filter((v) => v / gt >= 0.04).length;
    const st = {}; es.forEach((e) => { if (e.studio) st[e.studio] = (st[e.studio] || 0) + 1; }); W.studios = Object.entries(st).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n }));
    const fm = {}; es.forEach((e) => { fm[e.format] = (fm[e.format] || 0) + 1; }); W.formats = Object.entries(fm).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, name: FORMAT_TR[k] || k, n }));
    W.movieShare = (fm.MOVIE || 0) / Math.max(es.length, 1);
    W.top = scored.slice().sort((a, b) => b.score - a.score || b.min - a.min).slice(0, 5); W.longest = es.slice().sort((a, b) => b.eps - a.eps)[0] || null;
    W.months = Array(12).fill(0); es.forEach((e) => { W.months[+e.date.slice(5, 7) - 1]++; }); W.topMonthA = W.months.indexOf(Math.max(...W.months));
    const ys = es.map((e) => e.seasonYear).filter(Boolean); W.avgYear = ys.length ? avgOf(ys) : null; W.oldest = es.filter((e) => e.seasonYear).sort((a, b) => a.seasonYear - b.seasonYear)[0] || null;
    W.seasonal = ys.length ? ys.filter((y) => y >= year - 1).length / ys.length : 0; W.rewatch = es.reduce((s, e) => s + e.repeat, 0);
    const dec = {}; ys.forEach((y) => { const d = Math.floor(y / 10) * 10; dec[d] = (dec[d] || 0) + 1; }); W.decades = Object.entries(dec).sort((a, b) => b[0] - a[0]).map(([d, n]) => ({ name: `${d}'ler`, n }));
    const gShare = (names) => W.genres.filter((g) => names.includes(g.key)).reduce((s, g) => s + g.pct, 0) / 100, h = W.hoursTotal, mean = W.meanScore;
    const o = [];
    if (gShare(["Action", "Adventure"]) >= 0.4) o.push({ k: "Macera Savaşçısı", w: gShare(["Action", "Adventure"]) / 0.4, d: "Kılıç, büyü ve dostluk: tam senlik.", why: `Aksiyon ve macera ${pcAcc(pct(gShare(["Action", "Adventure"])))} pay` });
    if (gShare(["Slice of Life", "Comedy", "Romance"]) >= 0.4) o.push({ k: "Günlük Yaşam Sevdalısı", w: gShare(["Slice of Life", "Comedy", "Romance"]) / 0.4, d: "Küçük anların büyük hikâyelerini seviyorsun.", why: "Komedi, romantik ve günlük yaşam ağırlıklı" });
    if (gShare(["Psychological", "Thriller", "Mystery", "Horror"]) >= 0.3) o.push({ k: "Gerilim Avcısı", w: gShare(["Psychological", "Thriller", "Mystery", "Horror"]) / 0.3, d: "Sonu tahmin edilemeyen hikâyelerin peşindesin.", why: "Psikolojik ve gerilim ağırlıklı" });
    if (gShare(["Fantasy", "Sci-Fi", "Supernatural"]) >= 0.4) o.push({ k: "Dünya Kâşifi", w: gShare(["Fantasy", "Sci-Fi", "Supernatural"]) / 0.4, d: "Gerçek dünya dar geliyor, yenilerini geziyorsun.", why: "Fantastik ve bilim kurgu ağırlıklı" });
    if (W.movieShare >= 0.25) o.push({ k: "Film Gurmesi", w: W.movieShare / 0.25, d: "Tek seferde biten hikâyeler daha çok hoşuna gidiyor.", why: `İzlediklerinin ${pcAcc(pct(W.movieShare))} film` });
    if (h >= 120) o.push({ k: "Maratoncu", w: h / 120, d: "Bölümler arasında kalkıp su içmek sadece öneri.", why: `${nf.format(Math.round(h))} saat izleme` });
    if (mean != null && mean <= 6.5 && W.rated >= 8) o.push({ k: "Sert Eleştirmen", w: 1.3, d: "Puanlarını kolay vermiyorsun.", why: `Ortalama puan ${mean.toFixed(1).replace(".", ",")}` });
    if (mean != null && mean >= 8.2 && W.rated >= 8) o.push({ k: "Cömert Puancı", w: 1.3, d: "Her yapımda bir güzellik buluyorsun.", why: `Ortalama puan ${mean.toFixed(1).replace(".", ",")}` });
    if (W.avgYear && W.avgYear <= 2008) o.push({ k: "Klasik Avcısı", w: (2025 - W.avgYear) / 17, d: "Eski kaset kokusunu özlüyorsun.", why: `Ortalama yapım yılı ${Math.round(W.avgYear)}` });
    if (W.seasonal >= 0.5) o.push({ k: "Sezon Takipçisi", w: W.seasonal / 0.5, d: "Yeni sezonların ilk haftasında oradasın.", why: `Yapımların ${pcAcc(pct(W.seasonal))} son iki yıldan` });
    o.sort((a, b) => b.w - a.w); W.persona = o[0] || { k: "Gezgin Otaku", d: "Her türden bir şeyler izleyen meraklı bir izleyici.", why: "Dengeli bir liste" }; W.personaWhy = o.slice(0, 3).map((x) => x.why);

    const R = [], ad = (w, tag, t) => R.push({ w, tag, t });
    if (h >= 100) ad(h / 100, "saat", `${nf.format(Math.round(h))} saat izledin. Bu, ${Math.round(h / 24)} gün kesintisiz anime demek. Güneş ışığı mı? Duyduk.`);
    if (W.busy && W.busy.count >= 24) ad(W.busy.count / 24, "maraton", `${fmtDay(W.busy.date)} günü tek günde ${W.busy.count} bölüm bitirmişsin. Ertesi sabah nasıldı?`);
    if (mean != null && mean >= 8.3) ad(1.4, "puan", `Ortalama puanın ${mean.toFixed(1).replace(".", ",")}. Ya şanslısın ya da çok kolay mutlu oluyorsun.`);
    if (mean != null && mean <= 6.3) ad(1.4, "puan", `Ortalama puanın ${mean.toFixed(1).replace(".", ",")}. Hiçbir şey seni memnun etmiyor mu?`);
    if (W.genres[0] && W.genres[0].pct >= 35) ad(2, "tur", `Zamanının ${pcAcc(Math.round(W.genres[0].pct))} ${W.genres[0].name} türünde. Çeşitlilik denen bir şey var, haberin olsun.`);
    if (W.longest && W.longest.eps >= 50) ad(1.2, "uzun", `"${W.longest.title}" tam ${W.longest.eps} bölüm. Bu, bir bağlılık anıtı.`);
    if (W.rewatch >= 2) ad(1, "tekrar", `${W.rewatch} yapımı yeniden izlemişsin. Yeni bir şey bulamadın mı yoksa bu kadar mı iyiydi?`);
    if (W.studios[0] && W.studios[0].n >= 5) ad(1.3, "studyo", `${W.studios[0].name} yapımlarından ${W.studios[0].n} tane bitirdin. Hayran kulübü başkanı mısın?`);
    R.sort((a, b) => b.w - a.w); const out = [], tg = new Set(); for (const x of R) { if (out.length >= 3) break; if (!tg.has(x.tag)) { tg.add(x.tag); out.push(x.t); } }
    for (const f of ["Listen dengeli bir zevk gösteriyor. Tebrikler, bu da nadir.", "Bu yıl izlediklerin seni biraz daha ‘otaku’ yaptı.", "Sıradaki bölüm için izin istemene gerek yok."]) { if (out.length >= 3) break; out.push(f); }
    W.roasts = out;
    finishCard(W, [["MAR", scoreK(h, 120)], ["ÇEŞ", scoreK(W.genreCount, 6)], ["PUA", mean == null ? 60 : 35 + 64 * clamp((mean - 5) / 4, 0, 1)], ["KLS", W.avgYear ? 35 + 64 * clamp((2025 - W.avgYear) / 25, 0, 1) : 50], ["FİL", 35 + 64 * clamp(W.movieShare / 0.35, 0, 1)], ["HIZ", scoreK(W.busy ? W.busy.count : 0, 14)]]);
    W.poster = { blocks: [[nf.format(es.length), "anime", "open"], [nf.format(W.episodes), "bölüm", "closed"], [nf.format(Math.round(h)), "saat izleme", "review"], [mean == null ? "—" : mean.toFixed(1).replace(".", ","), "ortalama puan", "link"]], chips: W.genres.slice(0, 3).map((g) => ({ name: g.name, color: g.color })), waffle: W.genres.map((g) => ({ pct: g.pct, color: g.color })) };
    if (W.top.length >= 3) W.wordsCard = { name: "En iyiler", title: "En yüksek puan verdiklerin", words: W.top.map((e) => ({ w: e.title, n: e.score })), lines: [`En yüksek puanın: ${W.top[0].title} (${(W.top[0].score / 10).toFixed(1).replace(".", ",")}).`, `${nf.format(W.rated)} yapıma puan verdin.`] };
    return W;
  }

  /* =====================================================
     Slaytlar
  ===================================================== */
  const hoursSlide = (W) => ({ t: "t-link", r(root) {
    const n = big("0", 46), h = Math.round(W.hoursTotal), d = Math.floor(h / 24);
    root.append(say("Toplam izleme süren"), n, say("saat."), say(`${nf.format(W.nAnime)} anime, ${nf.format(W.episodes)} bölüm.${d >= 1 ? ` Bu, ${d} gün ${h % 24} saat kesintisiz izleme demek.` : ""}`, true), el("div", "grow"));
    const f = el("div", "chips"); W.formats.slice(0, 4).forEach((x) => f.append(el("span", "chip", `${x.name}: ${x.n}`))); root.append(f); countUp(n, h);
  } });
  const genreSlide = (W) => ({ t: "t-ink", r(root) {
    const g = W.genres[0]; root.append(say("En çok izlediğin tür"), big(g.name, 22), say(`Zamanının %${Math.round(g.pct)} bu türde. Her kare, izleme süreni %1'i.`));
    K.gfx.waffleCanvas(fillBox(root), W.genres.map((x) => ({ pct: x.pct, color: x.color })));
    const lg = el("div", "legend"); W.genres.slice(0, 5).forEach((x) => { const row = el("div"), dot = el("i"); dot.style.background = x.color; row.append(dot, el("span", "", x.name), el("span", "", `%${Math.round(x.pct)}`)); lg.append(row); }); root.append(lg);
  } });
  const studioSlide = (W) => ({ t: "t-closed", dur: 7.5, r(root) {
    const s = W.studios, mx = s[0].n; root.append(say("En çok izlediğin stüdyo"), big(s[0].name, 18), say(`${s[0].n} yapımını bitirdin.`, true), el("div", "grow"));
    K.gfx.rankBars(root, s.map((x, i) => ({ label: x.name, text: `${x.n} anime`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const topSlide = (W) => ({ t: "t-review", dur: 8, r(root) {
    const t = W.top; root.append(say("En yüksek puan verdiklerin"), big(t[0].title, 14), say(`${(t[0].score / 10).toFixed(1).replace(".", ",")} ile listenin zirvesi.`, true), el("div", "grow"));
    K.gfx.rankBars(root, t.map((x, i) => ({ label: x.title, text: (x.score / 10).toFixed(1).replace(".", ","), pct: x.score, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const monthSlide = (W) => ({ t: "t-open", r(root) {
    const mx = Math.max(...W.months, 1), top = W.topMonthA; root.append(say("En çok anime bitirdiğin ay"), big(MONTHS[top], 24), say(`${W.months[top]} anime bitirdin.`, true), el("div", "grow"));
    const w = el("div", "wk"); w.style.gridTemplateColumns = "repeat(12,minmax(0,1fr))"; W.months.forEach((v, i) => { const c = el("div"), b = el("i", i === top ? "top" : ""); b.dataset.h = Math.max(Math.round((v / mx) * 100), 1); c.append(b, el("span", "", MONTHS[i].slice(0, 3))); w.append(c); }); root.append(w);
    after(() => w.querySelectorAll("i").forEach((b) => { b.style.height = b.dataset.h + "%"; }));
  } });
  const ageSlide = (W) => ({ t: "t-link", dur: 7.5, r(root) {
    const n = big("0", 46), d = W.decades.slice(0, 5), mx = Math.max(...d.map((x) => x.n), 1);
    root.append(say("İzlediklerinin ortalama yapım yılı"), n, say(W.oldest ? `En eskisi ${W.oldest.title} (${W.oldest.seasonYear}).` : ""), el("div", "grow"));
    K.gfx.rankBars(root, d.map((x, i) => ({ label: x.name, text: `${x.n} anime`, pct: (x.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow")); countUp(n, Math.round(W.avgYear), (v) => String(v));
  } });

  function duelRounds(A, B) {
    const R = [], add = (id, label, a, b, fmt) => { if (a == null || b == null) return; R.push({ id, label, a, b, fmt: fmt || ((v) => nf.format(v)), win: a > b ? "a" : b > a ? "b" : "t" }); };
    add("anime", "Bitirilen anime", A.nAnime, B.nAnime); add("episodes", "Toplam bölüm", A.episodes, B.episodes); add("hours", "İzleme saati", Math.round(A.hoursTotal), Math.round(B.hoursTotal), (v) => `${nf.format(v)} sa`);
    if (A.meanScore != null && B.meanScore != null) add("score", "Ortalama puan", +A.meanScore.toFixed(1), +B.meanScore.toFixed(1), (v) => String(v).replace(".", ","));
    add("genres", "Tür çeşitliliği", A.genreCount, B.genreCount); if (A.busy && B.busy) add("busy", "Maraton günü", A.busy.count, B.busy.count, (v) => `${v} bölüm`); add("power", "Otaku kartı gücü", A.overall, B.overall);
    return R;
  }
  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const ICON_SET = {
    "Macera Savaşçısı": svg('<path d="M4 20 20 4M14 4h6v6M4 14v6h6"/>', "none"), "Günlük Yaşam Sevdalısı": svg('<path d="M3 11 12 3l9 8v10H3z"/><path d="M9 21v-6h6v6" fill="none" stroke="#fff" stroke-width="0"/>'),
    "Gerilim Avcısı": svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>', "none"), "Dünya Kâşifi": svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', "none"),
    "Film Gurmesi": svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M8 5v14M16 5v14"/>', "none"), "Maratoncu": svg('<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2"/>', "none"),
    "Sert Eleştirmen": svg('<path d="M12 2 15 9l7 .7-5.3 4.8 1.6 7L12 17.8 5.7 21.5l1.6-7L2 9.7 9 9z"/>'), "Cömert Puancı": svg('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>'),
    "Klasik Avcısı": svg('<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>'), "Sezon Takipçisi": svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/>', "none"),
    "Gezgin Otaku": svg('<path d="M12 2 4 7v6c0 5 3.5 8 8 9 4.500-1 8-4 8-9V7z"/>'),
  };
  ICON_SET.default = ICON_SET["Gezgin Otaku"];

  Wrapped.register({
    id: "anime", name: "Anime Wrapped", brand: "Anime Wrapped", icon: ICON_SET["Film Gurmesi"], blurb: "İzleme saatin, türlerin, stüdyoların, puanların.", hashtags: "#AnimeWrapped #AniList #Anime",
    theme: { id: "anime", skin: "anime", motif: "dots", wipe: "slash", css: "theme-anime.css", display: '"Bangers","Impact","Arial Black",sans-serif', fontCheck: ['900 80px "Bangers"'],
      colors: { merge: "#7C3AED", open: "#FF3D8B", closed: "#FFD60A", review: "#00D1FF", link: "#FF7A00", ink: "#1A0B2E", paper: "#FFF7E6" },
      fg: { merge: "#FFFFFF", open: "#FFFFFF", closed: "#1A0B2E", review: "#1A0B2E", link: "#1A0B2E", ink: "#FFF7E6" } },
    input: { kind: "user", label: "AniList kullanıcı adı", placeholder: "anilist kullanıcı adı", rivalPlaceholder: "rakibinin AniList adı", years: true, duel: true },
    icons: ICON_SET, duelHighlights: ["anime", "hours", "score", "power"],
    vocab: { noun: "bölüm", plPoss: "bölümlerinin", doVerb: "izledin", doVerb1: "izledim", activeVerb: "anime bitirdin", weekdayVerb: "anime bitiriyorsun", night: "Gece otakusu", morning: "Sabah otakusu", evening: "Akşam otakusu", day: "Gündüz otakusu", hoursLead: "En verimli saatin",
      busyLead: "En büyük maraton günün", streakLine: "gün üst üste anime bitirdin", streakLine1: "gün üst üste anime bitirdim", skyTitle: "Anime şehrin", skyCard: "anime şehrim", skyName: "Anime şehri", introTail: "anime yılın", introTail1: "anime yılım", personaLead: "Otaku kişiliğin", personaLead1: "Otaku kişiliğim", cardLead: "Otaku kartın hazır.", cardLead1: "Otaku kartım", cardWho: "olarak izliyorsun", devName: "Otaku kartı" },
    makeInput(v) { const u = String(v.user || "").trim().replace(/^@/, "").replace(/^https?:\/\/anilist\.co\/user\//i, "").replace(/\/.*$/, ""); if (!/^[A-Za-z0-9_]{2,20}$/.test(u)) return { error: "Geçerli bir AniList kullanıcı adı yaz." }; return { user: u, label: "@" + u, query: { u } }; },
    fromQuery(q) { const u = q.get("u"); if (!u || q.get("s") !== "anime") return null; const v = q.get("v"); return { input: { user: u, label: "@" + u, query: { u } }, rival: v ? { user: v, label: "@" + v, query: { u: v } } : null, year: +q.get("y") }; },
    load, analyze, isEmpty: (W) => W.nAnime < 3,
    slides(W) {
      const L = [SL.intro(W)]; const sf = (n) => Wrapped.kit.sceneFor(W, n);
      if (W.hasCal && W.total > 0) { const a = SL.activity(W); L.push(a[0], ...[sf("panels")].filter(Boolean), sf("scouter") || hoursSlide(W), ...a.slice(1)); } else L.push(sf("scouter") || hoursSlide(W));
      if (W.genres.length) L.push(genreSlide(W));
      if (W.studios.length >= 2) L.push(studioSlide(W));
      if (W.top.length >= 3) L.push(topSlide(W));
      L.push(monthSlide(W));
      if (W.avgYear && W.decades.length >= 2) L.push(ageSlide(W));
      if (W.hasCal && W.total > 0) L.push(SL.skyline(W));
      L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W)); return L;
    },
    duelRounds,
    caption(W, url) { return `${W.year} Anime Wrapped'ım 🎌\n${nf.format(W.nAnime)} anime · ${nf.format(Math.round(W.hoursTotal))} saat · ${W.persona.k}\nOtaku kartım: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#AnimeWrapped #AniList #Anime #${W.year}`; },
    errMsg(e, who) { const u = String(who).replace(/^@/, ""); if (e.code === "notfound") return `"${u}" adında bir AniList kullanıcısı bulunamadı ya da listesi gizli.`; if (e.code === "empty") return `${who} için seçilen yılda tamamlanma tarihi girilmiş anime bulunamadı. AniList'te "Completed" tarihinin dolu olması gerekir.`; if (e.code === "ratelimit") return "AniList istek sınırına ulaşıldı. Bir dakika sonra tekrar dene."; if (e.code === "network") return "AniList'e ulaşılamadı. Bağlantını kontrol edip tekrar dene."; return null; },
  });
})();
