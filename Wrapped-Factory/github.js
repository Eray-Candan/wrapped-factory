/* GitHub Wrapped eklentisi */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { $, el, clamp, nf, pad, wait, hash, rng, toast, mkErr, cap, THIS_YEAR, NOW, localISO, parseD, fmtDay, weekdayName, pcAcc, pcLoc, suf3, activity, say, big, after, countUp, fillBox, SL } = K;

  const LANG_COLOR = {
    JavaScript: "#F7DF1E", TypeScript: "#4F8CFF", Python: "#2FD1A4", Java: "#FF8A3D", C: "#9AA3B2", "C++": "#F34B7D", "C#": "#7FD962",
    Go: "#00C2E0", Rust: "#E8A87C", PHP: "#9B8CFF", Ruby: "#FF5A5A", Swift: "#FF7A45", Kotlin: "#B58CFF", Dart: "#35D0BA", HTML: "#FF6B3D",
    CSS: "#A78BFA", SCSS: "#E070B0", Shell: "#A6E22E", Vue: "#41B883", Lua: "#7C8CFF", "Jupyter Notebook": "#F5853F", Dockerfile: "#5BB3D6",
    Makefile: "#6FA83A", R: "#2C8FE0", Scala: "#DC322F", Haskell: "#8F6FD1", Elixir: "#9A6BB0", Svelte: "#FF3E00", Zig: "#EC915C", PowerShell: "#5391FE",
  };
  const FALLBACK = ["#FF8FA3", "#7BDFF2", "#B2F7EF", "#EFC3E6", "#F0A6CA", "#FFD166", "#06D6A0", "#9D8DF1"];
  const langColor = (n) => LANG_COLOR[n] || FALLBACK[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACK.length];


  /* =====================================================
     GitHub veri katmanı
  ===================================================== */
  let TOKEN = "";
  async function gh(path) {
    let r;
    try { r = await fetch("https://api.github.com" + path, { headers: { Accept: "application/vnd.github+json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) } }); }
    catch { throw mkErr("network"); }
    if (r.status === 404) throw mkErr("notfound");
    if (r.status === 401) throw mkErr("badtoken");
    if (r.status === 403 || r.status === 429) {
      if (r.status === 429 || r.headers.get("x-ratelimit-remaining") === "0") throw mkErr("ratelimit", +r.headers.get("x-ratelimit-reset") * 1000 || 0);
      throw mkErr("forbidden");
    }
    if (!r.ok) throw mkErr("http", r.status);
    return r.json();
  }

  async function fetchRaw(user, year, step) {
    const ck = `ghw:v2:${user.toLowerCase()}:${year}`;
    try { const c = JSON.parse(localStorage.getItem(ck) || "null"); if (c && Date.now() - c.t < 30 * 60e3) return c.raw; } catch { /* önbellek yok */ }

    step("Profil alınıyor");
    const u = await gh(`/users/${encodeURIComponent(user)}`);
    const login = u.login;

    step("Depolar taranıyor");
    let repos = [];
    for (let p = 1; p <= 3; p++) {
      const page = await gh(`/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner&sort=pushed&page=${p}`);
      repos = repos.concat(page);
      if (page.length < 100) break;
    }
    repos = repos.map((r) => ({ name: r.name, full: r.full_name, fork: r.fork, stars: r.stargazers_count, forks: r.forks_count, lang: r.language, desc: r.description, pushed: r.pushed_at, size: r.size }));

    step("Katkı takvimi çiziliyor");
    let days = null;
    try {
      const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=${year}`);
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.contributions)) days = j.contributions.map((d) => ({ date: d.date, count: d.count })); }
    } catch { /* üçüncü taraf servis kapalı olabilir */ }

    let prev = null;
    if (days) {
      try {
        const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=${year - 1}`);
        if (r.ok) {
          const pd = (await r.json()).contributions || [], sum = (a) => a.reduce((s, d) => s + d.count, 0);
          const cut = `${year - 1}${localISO(new Date()).slice(4)}`;
          prev = { total: sum(pd), same: year === THIS_YEAR ? sum(pd.filter((d) => d.date <= cut)) : sum(pd) };
        }
      } catch { /* geçen yıl verisi yok */ }
    }

    step("Commit saatleri toplanıyor");
    let commits = [], commitTotal = 0;
    try {
      for (let p = 1; p <= 3; p++) {
        const j = await gh(`/search/commits?q=${encodeURIComponent(`author:${login} author-date:${year}-01-01..${year}-12-31`)}&sort=author-date&order=desc&per_page=100&page=${p}`);
        commitTotal = j.total_count || 0;
        commits = commits.concat((j.items || []).map((i) => ({ d: i.commit.author.date, m: String(i.commit.message || "").split("\n")[0].slice(0, 100) })));
        if ((j.items || []).length < 100) break;
      }
    } catch (e) { if (e.code === "badtoken") throw e; }

    step("Diller hesaplanıyor");
    const cand = repos.filter((r) => !r.fork && r.pushed && new Date(r.pushed).getFullYear() >= year).slice(0, 8);
    const langs = {};
    await Promise.all(cand.map(async (r) => {
      try { const l = await gh(`/repos/${r.full}/languages`); for (const [k, v] of Object.entries(l)) langs[k] = (langs[k] || 0) + v; } catch { /* atla */ }
    }));
    if (!Object.keys(langs).length) for (const r of repos) if (!r.fork && r.lang) langs[r.lang] = (langs[r.lang] || 0) + Math.max(r.size, 1) * 1024;

    const raw = { year, user: { login, name: u.name, avatar: u.avatar_url, created: u.created_at, followers: u.followers, repos: u.public_repos }, repos, days, prev, commits, commitTotal, langs };
    try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), raw })); } catch { /* dolu */ }
    return raw;
  }

  /* =====================================================
     Eğlenceli türetilmiş ölçüler
  ===================================================== */

  const LANG_YEAR = {
    C: 1972, "C++": 1985, "C#": 2000, Python: 1991, JavaScript: 1995, TypeScript: 2012, Java: 1995, Go: 2009, Rust: 2010, Swift: 2014, Kotlin: 2011,
    PHP: 1995, Ruby: 1995, Dart: 2011, HTML: 1993, CSS: 1996, SCSS: 2006, Vue: 2014, Lua: 1993, "Jupyter Notebook": 2014, Dockerfile: 2013,
    Makefile: 1976, R: 1993, Scala: 2004, Haskell: 1990, Elixir: 2011, Svelte: 2016, Zig: 2016, PowerShell: 2006, Shell: 1971, Perl: 1987,
    "Objective-C": 1984, Assembly: 1949, Fortran: 1957, MATLAB: 1984, Julia: 2012, Clojure: 2007, Erlang: 1986, OCaml: 1996, Groovy: 2003,
    "Visual Basic": 1991, "Vim Script": 1991, "Emacs Lisp": 1985, Nix: 2003, Solidity: 2014, PLpgSQL: 1998, TSX: 2012, CMake: 2000, GLSL: 2004,
  };
  const STOP = new Set(["the", "a", "an", "to", "in", "of", "and", "for", "with", "on", "at", "by", "from", "is", "it", "this", "that", "as", "be", "or", "not", "into", "up", "merge", "pull", "request", "branch", "main", "master", "of", "bir", "ve", "ile", "için", "bu", "de", "da", "ki", "mi", "co", "authored"]);

  function enrichPre(S, raw) {
    const msgs = (raw.commits || []).map((c) => c.m || "").filter(Boolean);
    if (msgs.length >= 15) {
      const cnt = {}; let fix = 0, wip = 0, upd = 0, emoji = 0, len = 0, longest = "";
      for (const m of msgs) {
        len += m.length; if (m.length > longest.length) longest = m;
        if (/\p{Extended_Pictographic}/u.test(m)) emoji++;
        if (/\b(fix|fixes|fixed|bugfix|hotfix)\b/i.test(m)) fix++;
        if (/\bwip\b/i.test(m)) wip++;
        if (/^\s*(update|updates|updated)\b/i.test(m)) upd++;
        const ws = new Set(m.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, " ").split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)));
        for (const w of ws) cnt[w] = (cnt[w] || 0) + 1;
      }
      const words = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([w, n]) => ({ w, n }));
      S.msg = { n: msgs.length, avg: Math.round(len / msgs.length), fix, wip, upd, emoji, longest };
      S.words = words.length >= 4 && words[0].n >= 3 ? words : null;
    }
    // en uzun ara (ardından aktif bir gün gelen sıfır günleri)
    let g = { len: 0, s: 0, e: 0 }, run = 0, rs = 0;
    for (let i = 0; i < S.days.length; i++) { if (S.days[i].count === 0) { if (!run) rs = i; run++; } else { if (run > g.len) g = { len: run, s: rs, e: i - 1 }; run = 0; } }
    S.gap = g;
    // kod yaşı: dillerin ilk çıkış yıllarının ağırlıklı ortalaması
    const ent = Object.entries(raw.langs || {}); let tot = 0, known = 0, ws = 0, oldest = null, newest = null;
    for (const [n, v] of ent) tot += v;
    for (const [n, v] of ent) { const y = LANG_YEAR[n]; if (!y) continue; known += v; ws += v * y; if (v / tot >= 0.03) { if (!oldest || y < oldest.y) oldest = { n, y }; if (!newest || y > newest.y) newest = { n, y }; } }
    S.codeAge = tot && known / tot >= 0.6 && oldest && newest ? { age: Math.max(1, Math.round(raw.year - ws / known)), avgY: ws / known, oldest, newest } : null;
    // geçen yılın aynı dönemiyle kıyas
    S.cmp = S.hasCal && raw.prev && raw.prev.same > 0 ? { prev: raw.prev.same, now: S.total, pct: Math.round((S.total / raw.prev.same - 1) * 100) } : null;
  }

  function enrichPost(S) {
    const k = (x, kk) => 35 + 64 * (1 - Math.exp(-Math.max(x, 0) / kk));
    const actRatio = S.hasCal && S.elapsed ? S.active / S.elapsed : 0;
    const A = [
      ["SER", S.hasCal ? k(S.best.len, 25) : 40], ["İST", S.hasCal ? clamp(35 + 64 * (actRatio / 0.75), 35, 99) : 40],
      ["GEC", S.hours ? clamp(35 + 64 * (S.nightShare / 0.5), 35, 99) : 45], ["DİL", S.langCount ? k(S.langCount, 3) : 40],
      ["YIL", k(S.starsTotal, 60)], ["HIZ", S.hasCal ? k(S.avgActive, 6) : 40],
    ].map(([n, v]) => ({ k: n, v: Math.round(v) }));
    S.scores = A;
    S.overall = clamp(Math.round(A.reduce((s, a) => s + a.v, 0) / A.length), 45, 99);
    S.rarity = S.overall >= 82 ? "Efsane" : S.overall >= 72 ? "Altın" : S.overall >= 62 ? "Gümüş" : "Bronz";

    // tatlı-acımasız yorumlar
    const c = [], add = (w, tag, t) => c.push({ w, tag, t }), p = (x) => Math.round(x * 100);
    const m = S.msg, nm = (n) => nf.format(n);
    if (S.hours && S.nightShare >= 0.3) add(S.nightShare * 3.2, "saat", `Commitlerinin ${pcAcc(p(S.nightShare))} gece 22 ile 04 arasında. Uyku senin için isteğe bağlı bir bağımlılık.`);
    if (S.hours && S.morningShare >= 0.3) add(S.morningShare * 3, "saat", `Commitlerinin ${pcAcc(p(S.morningShare))} sabah 05 ile 10 arasında. Horoz bile "sakin ol" diyor.`);
    if (S.hasCal && S.weekendShare >= 0.42) add(S.weekendShare * 2.6, "gun", `Katkılarının ${pcAcc(p(S.weekendShare))} hafta sonu. Hobi mi iş mi, kimse bilmiyor.`);
    if (S.hasCal && S.total > 0 && S.topWeekday === 0) add(1.1, "gun", "En çok Pazartesi kod yazıyorsun. Pazartesi sendromunu commit ile tedavi ediyorsun.");
    if (S.hasCal && S.total > 0 && S.topWeekday === 4) add(1.1, "gun", "En yoğun günün Cuma. Cuma akşamı deploy etmek, sadece cesur yürekler için.");
    if (S.hasCal && S.best.len >= 14) add(S.best.len / 12, "seri", `${S.best.len} gün üst üste commit. Güneş ışığı diye bir şey olduğunu duydum.`);
    if (S.hasCal && S.best.len > 0 && S.best.len <= 4) add(1.2, "seri", `En uzun serin ${S.best.len} gün. İstikrar bir yaşam tarzı, istersen deneyebilirsin.`);
    if (S.busy && S.avgActive && S.busy.count / S.avgActive >= 6) add(S.busy.count / S.avgActive / 4, "zirve", `Tek günde ${nm(S.busy.count)} katkı. Ya teslim tarihi vardı ya da kahve fazla güçlüydü.`);
    if (S.gap.len >= 21) add(S.gap.len / 20, "ara", `${S.gap.len} gün ara verdin. Tatil miydi yoksa "yarın başlarım" mı?`);
    if (m && m.fix >= 10) add(m.fix / 8, "mesaj", `Commit mesajlarında "fix" ${m.fix} kez geçiyor. Hatalar seni gerçekten seviyor.`);
    if (m && m.wip >= 4) add(m.wip / 3, "mesaj", `"wip" yazarak ${m.wip} commit attın. Hepimiz biliyoruz, o iş hiç bitmeyecek.`);
    if (m && m.upd >= 8) add(m.upd / 6, "mesaj", `"update" diye ${m.upd} commit mesajı yazmışsın. Bu bir sanat dalı sayılır.`);
    if (m && m.avg <= 18) add(1.3, "mesaj", `Commit mesajların ortalama ${m.avg} karakter. Kısa ve gizemli, tıpkı bir dedektif gibi.`);
    if (m && m.emoji >= 8) add(m.emoji / 6, "mesaj", `${m.emoji} commit mesajında emoji kullanmışsın. Git geçmişin biraz festival gibi.`);
    if (S.langs.length && S.langs[0].pct >= 88) add(1.4, "dil", `Tek dile bu kadar sadakat... Evliliklerde bile bu kadar nadir.`);
    if (S.langCount >= 5) add(S.langCount / 4, "dil", `${S.langCount} dilde kod yazdın. Hangisinde bug yazdığını karıştırıyor olmalısın.`);
    if (S.starsTotal >= 100) add(S.starsTotal / 80, "yildiz", `${nm(S.starsTotal)} yıldız toplamışsın. Demek ki biri README'ni gerçekten okuyor.`);
    if (S.starsTotal === 0 && (S.raw.repos || []).length >= 5) add(1, "yildiz", "Hiç yıldızın yok. Merak etme, kodunun henüz kimseyi kızdırmadığı anlamına gelir.");
    if (S.hasCal && S.total >= 1500) add(S.total / 1200, "toplam", `${nm(S.total)} katkı. Klavyen şikayet için avukat tutmuş olabilir.`);
    if (S.hasCal && S.total > 0 && S.total < 40) add(1.3, "toplam", `Bu yıl ${nm(S.total)} katkı. Kodun az, huzurun çok.`);
    if (S.cmp && S.cmp.pct >= 50) add(1.4, "kiyas", `Geçen yıla göre ${pcAcc(S.cmp.pct)} daha fazla katkı. Kendinle yarışıp kazanıyorsun.`);
    if (S.cmp && S.cmp.pct <= -40) add(1.3, "kiyas", `Geçen yıla göre katkılar düşmüş. Hayatın başka işleri de var, anlıyoruz.`);
    c.sort((a, b) => b.w - a.w);
    const out = [], tags = new Set();
    for (const x of c) { if (out.length >= 3) break; if (tags.has(x.tag)) continue; tags.add(x.tag); out.push(x.t); }
    for (const x of c) { if (out.length >= 3) break; if (!out.includes(x.t)) out.push(x.t); }
    const fall = ["Verilerine bakılırsa sen gerçekten kod yazan birisin. Tebrikler, bu da bir şey.", "İstatistiklerin dürüst bir geliştirici portresi çiziyor: ne çok ne az, tam kararında.", "Bu yıl da commit attın, depoların seni unutmadı."];
    for (const f of fall) { if (out.length >= 3) break; out.push(f); }
    S.roasts = out;
  }


  /* =====================================================
     Analiz
  ===================================================== */
  function analyze(raw) {
    const S = { raw, year: raw.year, user: { ...raw.user, handle: "@" + raw.user.login }, partial: raw.year === THIS_YEAR };
    activity(S, { days: raw.days, hourTimes: (raw.commits || []).map((c) => c.d) });
    S.hoursNote = `Son ${nf.format(S.hourN)} commitine göre. Saatler bu cihazın saat dilimiyle gösterilir.`;
    const best = S.best;
    const lt = Object.values(raw.langs || {}).reduce((a, b) => a + b, 0);
    S.langs = lt ? Object.entries(raw.langs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, v]) => ({ name, pct: (v / lt) * 100 })) : [];
    S.langCount = lt ? Object.values(raw.langs).filter((v) => v / lt >= 0.03).length : 0;

    const own = (raw.repos || []).filter((r) => !r.fork);
    const inYear = own.filter((r) => r.pushed && new Date(r.pushed).getFullYear() === raw.year);
    const pool = inYear.length ? inYear : own;
    S.topRepo = pool.slice().sort((a, b) => b.stars - a.stars || new Date(b.pushed) - new Date(a.pushed))[0] || null;
    S.starsTotal = own.reduce((s, r) => s + r.stars, 0);

    enrichPre(S, raw);
    const opts = [];
    if (best.len >= 5) opts.push({ k: "Seri Katili", w: best.len / 21, d: "Bir kere başlayınca durmuyorsun.", why: `${best.len} günlük seri` });
    if (S.hours) opts.push({ k: "Gece Kuşu", w: S.nightShare / 0.3, d: "Dünya uyurken en iyi kodun çıkıyor.", why: `Commitlerinin ${pcAcc(Math.round(S.nightShare * 100))} gece 22–04 arası` });
    if (S.hours) opts.push({ k: "Sabahçı", w: S.morningShare / 0.3, d: "Güne commit ile başlıyorsun.", why: `Commitlerinin ${pcAcc(Math.round(S.morningShare * 100))} sabah 05–10 arası` });
    if (S.hasCal) opts.push({ k: "Hafta Sonu Savaşçısı", w: S.weekendShare / 0.4, d: "Asıl iş hafta sonu bitiyor.", why: `Katkılarının ${pcAcc(Math.round(S.weekendShare * 100))} hafta sonu` });
    if (S.langCount >= 4) opts.push({ k: "Çok Dilli", w: S.langCount / 6, d: "Tek bir dile sığmıyorsun.", why: `${S.langCount} dilde kod yazdın` });
    if (S.starsTotal >= 10) opts.push({ k: "Yıldız Avcısı", w: S.starsTotal / 60, d: "Projeleri başkalarının da işine yarıyor.", why: `${nf.format(S.starsTotal)} yıldız topladın` });
    if (S.hasCal && S.elapsed) opts.push({ k: "Düzenli Üretici", w: S.active / S.elapsed / 0.5, d: "Büyük patlamalar yok, istikrar var.", why: `Günlerinin ${pcLoc(Math.round((S.active / S.elapsed) * 100))} aktifsin` });
    if (S.hasCal && S.best.len >= 45) opts.push({ k: "Maraton Koşucusu", w: S.best.len / 40, d: "Hız değil, dayanıklılık senin işin.", why: `${S.best.len} günlük kesintisiz seri` });
    if (S.hasCal && S.total >= 1500) opts.push({ k: "Commit Makinesi", w: S.total / 1200, d: "Klavyen yorulmuş olabilir, sen yorulmamışsın.", why: `${nf.format(S.total)} katkı` });
    if (S.hasCal && S.elapsed > 30 && S.active / S.elapsed < 0.3 && S.busy && S.avgActive && S.busy.count / S.avgActive >= 7) opts.push({ k: "Son Dakikacı", w: 1.6, d: "Sessizlik, sessizlik, sonra büyük patlama.", why: `Tek günde ${nf.format(S.busy.count)} katkı` });
    opts.sort((a, b) => b.w - a.w);
    S.persona = opts[0] || { k: "Yeni Başlayan", d: "Yolun başındasın, bu yıl daha çok commit var.", why: "Yeni bir sayfa" };
    S.personaWhy = opts.slice(0, 3).map((o) => o.why);
    enrichPost(S);
    if (S.words) S.wordsCard = { name: "Commit kelimeleri", title: "Commit mesajlarında en çok geçenler", words: S.words, lines: [`"${S.words[0].w}" ${S.words[0].n} commit mesajında geçti.`, `${nf.format(S.msg.n)} mesaja bakıldı, ortalama uzunluk ${S.msg.avg} karakter.`] };
    S.poster = { chips: S.langs.slice(0, 3).map((l) => ({ name: l.name, color: langColor(l.name) })), waffle: S.langs.map((l) => ({ pct: l.pct, color: langColor(l.name) })) };
    if (!S.hasCal) S.poster.blocks = [[nf.format(raw.commitTotal), "commit", "open"], [nf.format((raw.repos || []).length), "depo", "closed"], [nf.format(S.starsTotal), "yıldız", "review"], [nf.format(raw.user.followers || 0), "takipçi", "link"]];
    return S;
  }


  /* =====================================================
     GitHub'a özgü slaytlar
  ===================================================== */
  const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8l3 6.3 6.9.9-5 4.8 1.3 6.8L12 17.3 5.8 20.6l1.3-6.8-5-4.8 6.9-.9z"/></svg>';
  const langSlide = (W) => ({ t: "t-ink", r(root) {
    root.append(say("Projelerinde en çok"), big(W.langs[0].name, 24), say(`kullandığın dil, payı %${Math.round(W.langs[0].pct)}. Her kare, kodunun %1'i.`));
    K.gfx.waffleCanvas(fillBox(root), W.langs.map((l) => ({ pct: l.pct, color: langColor(l.name) })));
    const lg = el("div", "legend"); W.langs.forEach((l) => { const row = el("div"), dot = el("i"); dot.style.background = langColor(l.name); row.append(dot, el("span", "", l.name), el("span", "", `%${Math.round(l.pct)}`)); lg.append(row); });
    root.append(lg);
  } });
  const ageSlide = (W) => ({ t: "t-open", dur: 7.5, r(root) {
    const n = big("0", 46), C = W.codeAge, a = C.age;
    const line = a < 12 ? "Taptaze bir yığın, modayı yakından takip ediyorsun." : a < 22 ? "Olgun ve dengeli bir yığın." : a < 32 ? "Klasikleri seviyorsun, saygı duyuyoruz." : "Müze kalitesinde bir yığın, saygı duyuyoruz.";
    root.append(say("Kod yaşın"), n, say("Kullandığın dillerin ortalama yaşı."), say(`${line} En eski dilin ${C.oldest.n} (${C.oldest.y}), en yenisi ${C.newest.n} (${C.newest.y}).`, true));
    K.gfx.timelineCanvas(fillBox(root), { items: W.langs.map((l) => ({ n: l.name, y: LANG_YEAR[l.name], pct: l.pct, color: langColor(l.name) })).filter((l) => l.y), avg: C.avgY, year: W.year }); countUp(n, a);
  } });
  const repoSlide = (W) => ({ t: "t-open", r(root) {
    const r = W.topRepo, nameNode = big(r.name, 14); root.append(say("Yılın projesi"), nameNode);
    if (r.desc) { const d = say(r.desc, true); d.style.cssText = "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden"; root.append(d); }
    root.append(el("div", "grow"));
    const sn = big("0", 22), row = el("div"); row.style.cssText = "display:grid;grid-template-columns:auto minmax(0,1fr);gap:5cqw;align-items:center";
    const ic = el("div", "icon"); ic.style.cssText = "width:30cqw;height:30cqw"; ic.innerHTML = STAR; const col = el("div"); col.append(sn, say("yıldız")); row.append(ic, col);
    const meta = el("div", "chips"); meta.append(el("span", "chip", `${nf.format(r.forks)} fork`)); if (r.lang) meta.append(el("span", "chip", r.lang));
    root.append(row, meta); countUp(sn, r.stars);
  } });
  const commitOnly = (W) => ({ t: "t-open", r(root) { const n = big("0", 46); root.append(say("Bu yıl herkese açık"), n, say("commit yaptın."), el("div", "grow")); countUp(n, W.raw.commitTotal); } });

  /* ---- Düello turları ---- */
  function duelRounds(A, B) {
    const R = [], both = A.hasCal && B.hasCal;
    const add = (id, label, a, b, fmt) => { if (a == null || b == null) return; R.push({ id, label, a, b, fmt: fmt || ((v) => nf.format(v)), win: a > b ? "a" : b > a ? "b" : "t" }); };
    add("total", "Toplam katkı", both ? A.total : A.raw.commitTotal, both ? B.total : B.raw.commitTotal);
    if (both) {
      add("streak", "En uzun seri", A.best.len, B.best.len, (v) => `${nf.format(v)} gün`);
      add("active", "Aktif gün", A.active, B.active);
      add("busy", "Zirve günü", A.busy ? A.busy.count : 0, B.busy ? B.busy.count : 0);
    }
    if (A.hours && B.hours) add("night", "Gece commitleri", Math.round(A.nightShare * 100), Math.round(B.nightShare * 100), (v) => `%${v}`);
    add("stars", "Yıldız", A.starsTotal, B.starsTotal);
    add("langs", "Dil çeşitliliği", A.langCount, B.langCount);
    add("power", "Dev Kartı gücü", A.overall, B.overall);
    return R;
  }

  const ICON_SET = {
    "Gece Kuşu": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.6 14.4A9 9 0 0 1 9.6 3.4a9 9 0 1 0 11 11z"/></svg>',
    "Sabahçı": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.4" fill="currentColor"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M5.2 18.8l1.7-1.7M17.1 6.9l1.7-1.7"/></svg>',
    "Seri Katili": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.6 1.8 4.4 13.6h6.4l-1.1 8.6 9.9-12.2h-6.5z"/></svg>',
    "Hafta Sonu Savaşçısı": '<svg viewBox="0 0 24 24" fill="currentColor"><g opacity=".4"><rect x="1.5" y="9" width="2.4" height="6" rx="1"/><rect x="5.4" y="9" width="2.4" height="6" rx="1"/><rect x="9.3" y="9" width="2.4" height="6" rx="1"/><rect x="13.2" y="9" width="2.4" height="6" rx="1"/><rect x="17.1" y="9" width="2.4" height="6" rx="1"/></g><rect x="20.4" y="3" width="2.4" height="18" rx="1.2"/></svg>',
    "Çok Dilli": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.6" cy="9" r="5.4"/><circle cx="15.4" cy="9" r="5.4"/><circle cx="12" cy="15" r="5.4"/></svg>',
    "Yıldız Avcısı": STAR,
    "Düzenli Üretici": '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.6" y="6" width="2.4" height="12" rx="1.2"/><rect x="5.6" y="6" width="2.4" height="12" rx="1.2"/><rect x="9.6" y="6" width="2.4" height="12" rx="1.2"/><rect x="13.6" y="6" width="2.4" height="12" rx="1.2"/><rect x="17.6" y="6" width="2.4" height="12" rx="1.2"/></svg>',
    "Yeni Başlayan": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 21v-8.5C6.6 12.4 4 9.7 3.5 4.5 8.6 4.4 11.2 7 11.6 11 12.4 6.6 15.4 4 20.5 3.4c0 5.4-3 8.6-7.5 9.2V21z"/></svg>',
    "Son Dakikacı": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 2.5h6M19 5l1.5 1.5"/></svg>',
    "Maraton Koşucusu": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 2.5h2v19H5zM8 4h11l-3 4.5L19 13H8z"/></svg>',
    "Commit Makinesi": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="3.4"/><path d="M12 2.5l1.6 2.4 2.8-.8.9 2.8 2.8.9-.8 2.8 2.4 1.6-2.4 1.6.8 2.8-2.8.9-.9 2.8-2.8-.8L12 21.5l-1.6-2.4-2.8.8-.9-2.8-2.8-.9.8-2.8L2.5 12l2.4-1.6-.8-2.8 2.8-.9.9-2.8 2.8.8z"/></svg>',
  };
  ICON_SET.default = ICON_SET["Yeni Başlayan"];

  const cleanUser = (s) => String(s || "").trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").replace(/\/.*$/, "");
  const validUser = (u) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(u);

  Wrapped.register({
    id: "github", theme: { skin: "github" }, name: "GitHub Wrapped", brand: "GitHub Wrapped", color: "#6E40F2", fg: "#fff", icon: STAR,
    blurb: "Kodlama yılın: seriler, saatler, diller, dev kartı.", hashtags: "#GitHubWrapped #Kodlama #YazılımGeliştirici",
    input: { kind: "user", label: "GitHub kullanıcı adı", placeholder: "github kullanıcı adı", rivalPlaceholder: "rakibinin kullanıcı adı", years: true, duel: true, token: true },
    icons: ICON_SET, vocab: {}, duelHighlights: ["total", "streak", "stars", "power"],
    makeInput(v) { const u = cleanUser(v.user); if (!validUser(u)) return { error: "Geçerli bir GitHub kullanıcı adı yaz (harf, rakam ve tire)." }; return { user: u, label: "@" + u, query: { u } }; },
    fromQuery(q) { const u = q.get("u"); if (!u) return null; const v = q.get("v"); return { input: { user: u, label: "@" + u, query: { u } }, rival: v ? { user: v, label: "@" + v, query: { u: v } } : null, year: +q.get("y") }; },
    async load(input, ctx) { TOKEN = ctx.token || ""; return fetchRaw(input.user, ctx.year, ctx.step); },
    analyze(raw) { return analyze(raw); },
    isEmpty(W) { return !W.raw.commitTotal && !W.langs.length && !W.topRepo && (!W.hasCal || W.total === 0); },
    slides(W, K2) {
      const L = [SL.intro(W)]; const sf = (n) => Wrapped.kit.sceneFor(W, n);
      if (W.hasCal && W.total > 0) L.push(...SL.activity(W)); else if (W.raw.commitTotal > 0) L.push(commitOnly(W));
      if (W.hours) L.push(SL.hours(W));
      if (W.hasCal && W.total > 0) L.push(...[sf("graph")].filter(Boolean));
      if (W.hasCal && W.total > 0) L.push(SL.skyline(W));
      if (W.langs.length) L.push(langSlide(W));
      if (W.codeAge) L.push(ageSlide(W));
      if (W.wordsCard) L.push(SL.words(W));
      L.push(SL.roast(W));
      if (W.topRepo) L.push(repoSlide(W));
      L.push(SL.persona(W), SL.cardReveal(W), SL.studio(W));
      return L;
    },
    duelRounds,
    caption(W, url) {
      const bits = []; if (W.hasCal) bits.push(`${nf.format(W.total)} katkı`, `${W.best.len} günlük seri`); bits.push(W.persona.k);
      return `${W.year} GitHub Wrapped'ım ✨\n${bits.join(" · ")}\nDev kartım: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#GitHubWrapped #Kodlama #YazılımGeliştirici #${W.year}`;
    },
    errMsg(e, who) {
      switch (e.code) {
        case "notfound": return `"${String(who).replace(/^@/, "")}" adında bir GitHub kullanıcısı bulunamadı.`;
        case "ratelimit": return `GitHub istek sınırına ulaşıldı.${e.extra ? ` ${new Date(e.extra).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} sonra tekrar dene` : " Biraz sonra tekrar dene"} ya da aşağıdan kendi token'ını ekle.`;
        case "badtoken": return "Token geçersiz görünüyor. Boş bırakıp tekrar dene.";
        case "network": return "GitHub'a ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
        case "empty": return `${who} için seçilen yılda herkese açık etkinlik bulunamadı. Başka bir yıl dene.`;
        default: return null;
      }
    },
  });
})();
