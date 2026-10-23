/* WhatsApp Wrapped eklentisi: sohbet dışa aktarımı (.txt / .zip) tamamen tarayıcıda işlenir */
(() => {
  "use strict";
  const K = Wrapped.kit;
  const { el, clamp, nf, pad, wait, hash, rng, mkErr, cap, THIS_YEAR, NOW, localISO, fmtDay, pcAcc, activity, scoreK, finishCard, say, big, after, countUp, fillBox, SL } = K;
  const pct = (x) => Math.round(x * 100);
  const PCOL = ["review", "open", "link", "closed", "#B58CFF", "#7FD962", "#00C2E0", "#FF5A5A"];

  /* =====================================================
     Dosya okuma: .txt ya da WhatsApp .zip (küçük, bağımlılıksız zip okuyucu)
  ===================================================== */
  async function unzipTxt(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw mkErr("badfile");
    const cnt = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const ents = [];
    for (let i = 0; i < cnt; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const comp = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      ents.push({ name: new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), comp, cs, lho }); p += 46 + nl + xl + cl;
    }
    const ent = ents.find((x) => /_chat\.txt$/i.test(x.name)) || ents.find((x) => /\.txt$/i.test(x.name)); if (!ent) throw mkErr("badfile");
    const nl2 = dv.getUint16(ent.lho + 26, true), xl2 = dv.getUint16(ent.lho + 28, true), start = ent.lho + 30 + nl2 + xl2, data = u8.subarray(start, start + ent.cs);
    if (ent.comp === 0) return new TextDecoder("utf-8").decode(data);
    if (ent.comp !== 8 || typeof DecompressionStream === "undefined") throw mkErr("badfile");
    return new TextDecoder("utf-8").decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  }
  async function readText(file) { return /\.zip$/i.test(file.name) ? unzipTxt(await file.arrayBuffer()) : file.text(); }

  /* =====================================================
     Ayrıştırıcı: Android ve iPhone, 24 ve 12 saatlik, gün/ay sıralı biçimler
  ===================================================== */
  const HDR = /^[\u200e\u200f\u202a-\u202e\ufeff]*\[?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:[-–—]\s*)?([\s\S]*)$/;
  const MEDIA = /(dahil edilmedi|omitted|\(dosya ekli\)|\(file attached\)|IMG-\d|VID-\d|PTT-\d|STK-\d)/i, DELETED = /(bu mesaj silindi|this message was deleted|bu mesajı sildiniz|you deleted this message)/i;
  function parseChat(text) {
    const lines = text.replace(/\r/g, "").split("\n"), raw = []; let aMax = 0, bMax = 0;
    for (const ln of lines) {
      const m = HDR.exec(ln);
      if (m) { aMax = Math.max(aMax, +m[1]); bMax = Math.max(bMax, +m[2]); raw.push({ m, text: null }); }
      else if (raw.length) raw[raw.length - 1].cont = (raw[raw.length - 1].cont || []).concat(ln);
    }
    const dayFirst = aMax > 12 ? true : bMax > 12 ? false : true, out = [];
    for (const r of raw) {
      const m = r.m, a = +m[1], b = +m[2]; let y = +m[3]; if (y < 100) y += 2000;
      const day = dayFirst ? a : b, mon = dayFirst ? b : a; let h = +m[4]; const ap = (m[7] || "").toLowerCase().replace(/[.\s]/g, "");
      if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
      const d = new Date(y, mon - 1, day, h, +m[5], +(m[6] || 0)); if (isNaN(d) || mon < 1 || mon > 12) continue;
      const mm = /^([^:\n]{1,100}?):\s([\s\S]*)$/.exec(m[8].replace(/^[\u200e\u200f\u202a-\u202e]+/, "")); if (!mm) continue;     // sistem mesajı
      let body = mm[2] + (r.cont ? "\n" + r.cont.join("\n") : ""); body = body.replace(/^[\u200e\u200f]+/, "").trim();
      const del = DELETED.test(body), media = !del && body.length < 90 && MEDIA.test(body);
      out.push({ t: d.getTime(), who: mm[1].trim().replace(/^[\u200e\u200f\u202a-\u202e~]+/, ""), text: del || media ? "" : body, media, del });
    }
    return out;
  }
  function titleOf(name) { const m = /(?:WhatsApp (?:Chat with|Sohbeti)\s*[-–:]?\s*|with )(.+?)\.(?:txt|zip)$/i.exec(name); return m ? m[1].trim() : "Sohbet"; }

  /* =====================================================
     Örnek sohbet (ağsız, dosyasız deneme için)
  ===================================================== */
  /* =====================================================
     Analiz
  ===================================================== */
  const STOP = new Set("ve bir bu şu ama için gibi çok daha ben sen biz siz evet hayır tamam değil var yok ile mi mı mu mü da de ki ne nasıl ama fakat veya ya hani şey işte yani böyle şöyle olan oldu olur olmuş bana sana ona bize size onlar the and you that for with are not have this was but just can will its from what your yok zaten sonra önce şimdi bugün yarın dün diye kadar bile sadece hep her hiç aynı kendi bunu şunu onu".split(" "));
  const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, LAUGH = /(?:ha){2,}|(?:he){2,}|(?:ah){2,}|😂|🤣|😆|kkk+|\blol\b|\blmao\b/gi;
  const fmtDur = (s) => (s < 60 ? `${Math.round(s)} sn` : s < 3600 ? `${Math.round(s / 60)} dk` : `${Math.floor(s / 3600)} sa ${Math.round((s % 3600) / 60)} dk`);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  function analyze(raw, ctx) {
    const year = raw.year, opts = (ctx && ctx.options) || {}, all = raw.messages.filter((m) => new Date(m.t).getFullYear() === year).sort((a, b) => a.t - b.t);
    const cnt = {}; all.forEach((m) => { cnt[m.who] = (cnt[m.who] || 0) + 1; });
    const order = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), alias = {}; order.forEach((n, i) => { alias[n] = opts.anon ? `Kişi ${i + 1}` : n; });
    const P = {}; order.forEach((n) => { P[n] = { name: alias[n], n: 0, words: 0, media: 0, emoji: 0, laughs: 0, night: 0, starts: 0, replies: [], emojiMap: {} }; });
    const wcount = {}, emap = {}; let prev = null; const GAP = 6 * 3600e3;
    for (const m of all) {
      const p = P[m.who]; p.n++; const h = new Date(m.t).getHours(); if (h < 5) p.night++;
      if (m.media) p.media++;
      if (m.text) {
        const ws = m.text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean); p.words += ws.length;
        for (const w of ws) if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w) && !/^https?|^www/.test(w)) wcount[w] = (wcount[w] || 0) + 1;
        const em = m.text.match(EMOJI) || []; p.emoji += em.length; for (const e of em) { p.emojiMap[e] = (p.emojiMap[e] || 0) + 1; emap[e] = (emap[e] || 0) + 1; }
        p.laughs += (m.text.match(LAUGH) || []).length;
      }
      if (!prev || m.t - prev.t > GAP) p.starts++;
      else if (prev.who !== m.who) p.replies.push((m.t - prev.t) / 1000);
      prev = m;
    }
    const people = order.map((n) => ({ ...P[n], share: P[n].n / Math.max(all.length, 1), avgWords: P[n].words / Math.max(P[n].n - P[n].media, 1), nightShare: P[n].night / Math.max(P[n].n, 1), medReply: P[n].replies.length >= 20 ? median(P[n].replies) : null }));
    const title = opts.anon ? "Sohbetimiz" : (raw.title || "Sohbet");
    const Wd = { raw, year, partial: year === THIS_YEAR, nMsg: all.length, people, title, user: { login: title, name: title, avatar: null, handle: `${people.length} kişi, ${nf.format(all.length)} mesaj` } };
    const dc = {}; all.forEach((m) => { const d = localISO(new Date(m.t)); dc[d] = (dc[d] || 0) + 1; });
    const days = [], end = year === THIS_YEAR ? NOW : new Date(year, 11, 31); for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) { const iso = localISO(d); days.push({ date: iso, count: dc[iso] || 0 }); }
    activity(Wd, { days: all.length ? days : [], hourTimes: all.map((m) => m.t), minHours: 50 });
    Wd.hoursNote = `Mesajlaşma saatleri bu cihazın saat dilimiyle gösterilir.`;
    const medAll = median(people.flatMap((p) => p.replies)), emojiTotal = people.reduce((s, p) => s + p.emoji, 0), laughTotal = people.reduce((s, p) => s + p.laughs, 0), nn = Math.max(all.length, 1);
    Wd.medReply = medAll; Wd.emojiTotal = emojiTotal; Wd.laughTotal = laughTotal;
    Wd.emojis = Object.entries(emap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e, c]) => ({ e, c }));
    Wd.starters = people.filter((p) => p.starts > 0).slice().sort((a, b) => b.starts - a.starts);
    Wd.repliers = people.filter((p) => p.medReply != null).slice().sort((a, b) => a.medReply - b.medReply);
    // ödüller
    const best = (arr, f, min) => arr.filter((p) => f(p) != null && f(p) >= min).sort((a, b) => f(b) - f(a))[0];
    const A = [], add = (k, p, v) => { if (p) A.push({ k, who: p.name, v }); };
    add("Konuşkan", people[0], `${nf.format(people[0].n)} mesaj`);
    const ng = best(people.filter((p) => p.n >= 30), (p) => p.nightShare, 0.08); add("Gece Kuşu", ng, ng && `%${pct(ng.nightShare)} gece mesajı`);
    const fp = Wd.repliers[0]; add("Hızlı Parmak", fp, fp && `medyan cevap ${fmtDur(fp.medReply)}`);
    const st = Wd.starters[0]; add("Sohbeti Başlatan", st && st.starts >= 5 ? st : null, st && `${nf.format(st.starts)} kez başlattı`);
    const ed = best(people.filter((p) => p.n >= 30), (p) => p.emoji, 20); add("Emoji Delisi", ed, ed && `${nf.format(ed.emoji)} emoji`);
    const lm = best(people.filter((p) => p.n >= 30), (p) => p.avgWords, 6); add("Uzun Mesajcı", lm, lm && `mesaj başı ${lm.avgWords.toFixed(1).replace(".", ",")} kelime`);
    const lg = best(people, (p) => p.laughs, 10); add("Kahkaha Makinesi", lg, lg && `${nf.format(lg.laughs)} kahkaha`);
    if (people.length >= 3) { const q = people[people.length - 1]; add("Sessiz Dost", q, `${nf.format(q.n)} mesaj`); }
    Wd.awards = A.slice(0, 6);
    const wl = Object.entries(wcount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => ({ w, n }));
    if (opts.words && wl.length >= 4 && wl[0].n >= 5) Wd.wordsCard = { name: "Kelimeler", title: "En çok geçen kelimeler", words: wl, lines: [`"${wl[0].w}" ${nf.format(wl[0].n)} kez geçti.`, `${nf.format(all.length)} mesaja bakıldı.`] };
    // kişilik
    const P1 = [], night = Wd.nightShare || 0, morning = Wd.morningShare || 0, epm = emojiTotal / nn, lpm = laughTotal / nn, avgW = people.reduce((s, p) => s + p.words, 0) / Math.max(all.length - people.reduce((s, p) => s + p.media, 0), 1);
    if (Wd.hours && night >= 0.2) P1.push({ k: "Gece Kuşları", w: night / 0.2, d: "Dünya uyurken siz yazışıyorsunuz.", why: `Mesajlarınızın ${pcAcc(pct(night))} gece 22–04 arası` });
    if (Wd.hours && morning >= 0.3) P1.push({ k: "Sabah Grubu", w: morning / 0.3, d: "Güne mesajla başlıyorsunuz.", why: `Mesajlarınızın ${pcAcc(pct(morning))} sabah 05–10 arası` });
    if (medAll && medAll <= 90) P1.push({ k: "Anlık Yazışanlar", w: 90 / Math.max(medAll, 20), d: "Telefon elde, cevap saniyeler içinde.", why: `Medyan cevap süresi ${fmtDur(medAll)}` });
    if (epm >= 0.5) P1.push({ k: "Emoji Fabrikası", w: epm / 0.5, d: "Kelime yetmeyince emoji devreye giriyor.", why: `Mesaj başına ${epm.toFixed(1).replace(".", ",")} emoji` });
    if (lpm >= 0.08) P1.push({ k: "Kahkaha Grubu", w: lpm / 0.08, d: "Bu sohbette gülmeyen kalmıyor.", why: `${nf.format(laughTotal)} kahkaha` });
    if (avgW >= 12) P1.push({ k: "Uzun Mektuplaşanlar", w: avgW / 12, d: "Kısa yazmayı pek sevmiyorsunuz.", why: `Mesaj başı ${avgW.toFixed(1).replace(".", ",")} kelime` });
    if (Wd.hasCal && Wd.best.len >= 45) P1.push({ k: "Aralıksız Sohbet", w: Wd.best.len / 45, d: "Bir gün bile ara vermiyorsunuz.", why: `${Wd.best.len} gün üst üste` });
    if (Wd.hasCal && Wd.weekendShare >= 0.42) P1.push({ k: "Hafta Sonu Sohbeti", w: Wd.weekendShare / 0.42, d: "Asıl sohbet hafta sonu.", why: `Mesajlarınızın ${pcAcc(pct(Wd.weekendShare))} hafta sonu` });
    P1.sort((a, b) => b.w - a.w); Wd.persona = P1[0] || { k: "Dengeli Dostluk", d: "Ne eksik ne fazla, tam kararında.", why: "Dengeli bir sohbet" }; Wd.personaWhy = P1.slice(0, 3).map((o) => o.why);
    // yorumlar
    const R = [], ad = (w, tag, t) => R.push({ w, tag, t }), top = people[0];
    if (top && people.length >= 2 && top.share >= 0.5) ad(top.share * 3, "pay", `${top.name}, sohbetin %${pct(top.share)} kadarını yazdı. Diğerleri dinleyici koltuğunda.`);
    if (Wd.hours && night >= 0.15) ad(night * 3, "saat", `Mesajlarınızın ${pcAcc(pct(night))} gece 22 ile 04 arasında. Uyku diye bir şey duydum.`);
    if (medAll && medAll <= 120) ad(1.5, "cevap", `Medyan cevap süresi ${fmtDur(medAll)}. Anlık mesajlaşma mı, ortak bir telefon mu?`);
    if (laughTotal >= 50) ad(laughTotal / 100, "kahkaha", `${nf.format(laughTotal)} kahkaha. Bu sohbet bir eğlence sektörü.`);
    if (emojiTotal >= 100) ad(emojiTotal / 200, "emoji", `${nf.format(emojiTotal)} emoji kullandınız. Klavyenin emoji sekmesi yıpranmış olmalı.`);
    if (Wd.gap && Wd.gap.len >= 14) ad(Wd.gap.len / 14, "ara", `${Wd.gap.len} gün hiç yazışmadınız. Ortak bir kırgınlık mı yoksa sadece yoğunluk mu?`);
    if (Wd.busy && Wd.avgActive && Wd.busy.count / Wd.avgActive >= 5) ad(Wd.busy.count / Wd.avgActive / 4, "zirve", `Tek günde ${nf.format(Wd.busy.count)} mesaj. O gün ne olduysa, hepiniz oradaydınız.`);
    if (Wd.best.len >= 30) ad(Wd.best.len / 30, "seri", `${Wd.best.len} gün üst üste yazıştınız. Birbirinizden sıkılmamışsınız, tebrikler.`);
    R.sort((a, b) => b.w - a.w); const out = [], tg = new Set();
    for (const x of R) { if (out.length >= 3) break; if (!tg.has(x.tag)) { tg.add(x.tag); out.push(x.t); } }
    for (const x of R) { if (out.length >= 3) break; if (!out.includes(x.t)) out.push(x.t); }
    for (const f of ["Verilerinize bakılırsa gerçekten iyi anlaşıyorsunuz.", "Bu sohbet bir dostluk belgeseli olabilir.", "Mesajlar çoğaldıkça sohbet derinleşiyor."]) { if (out.length >= 3) break; out.push(f); }
    Wd.roasts = out;
    const fast = Wd.repliers[0] ? Wd.repliers[0].medReply : 600;
    finishCard(Wd, [["HIZ", 35 + 64 * clamp(1 - Math.log10(Math.max(medAll || 600, 10)) / 3.3, 0, 1)], ["GEC", 35 + 64 * clamp(night / 0.4, 0, 1)], ["EMJ", scoreK(epm * 10, 8)], ["KHK", scoreK(lpm * 100, 12)], ["İST", 35 + 64 * clamp((Wd.active / Math.max(Wd.elapsed, 1)) / 0.7, 0, 1)], ["UZN", scoreK(avgW, 9)]]);
    Wd.poster = {
      blocks: [[nf.format(all.length), "mesaj", "open"], [String(people.length), "kişi", "closed"], [String(Wd.best.len), "gün üst üste yazışma", "review"], [Wd.busy ? nf.format(Wd.busy.count) : "0", "tek günde zirve", "link"]],
      chips: people.slice(0, 3).map((p, i) => ({ name: p.name, color: PCOL[i] })), waffle: people.slice(0, 6).map((p, i) => ({ pct: p.share * 100, color: PCOL[i] })),
    };
    return Wd;
  }

  /* =====================================================
     Slaytlar
  ===================================================== */
  const whoSlide = (W) => ({ t: "t-link", dur: 7.5, r(root) {
    const ps = W.people.slice(0, 6), t0 = ps[0], mx = t0.n;
    root.append(say("Kim ne kadar yazıyor?"), big(t0.name, 20), say(`${t0.name} mesajların %${pct(t0.share)} kadarını yazdı.`, true), el("div", "grow"));
    K.gfx.rankBars(root, ps.map((p, i) => ({ label: p.name, text: `${nf.format(p.n)} mesaj, %${pct(p.share)}`, pct: (p.n / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const startSlide = (W) => ({ t: "t-merge", dur: 7.5, r(root) {
    const s = W.starters.slice(0, 6), mx = s[0].starts;
    root.append(say("Sohbeti kim başlatıyor?"), big(s[0].name, 20), say(`${nf.format(s[0].starts)} kez yeni bir sohbet açtı. Altı saatten uzun sessizliği bozan ilk mesaj sayılır.`, true), el("div", "grow"));
    K.gfx.rankBars(root, s.map((p, i) => ({ label: p.name, text: `${nf.format(p.starts)} kez`, pct: (p.starts / mx) * 100, hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const replySlide = (W) => ({ t: "t-open", dur: 7.5, r(root) {
    const s = W.repliers.slice(0, 6), mn = s[0].medReply;
    root.append(say("Kim hızlı cevap veriyor?"), big(s[0].name, 20), say(`Medyan cevap süresi ${fmtDur(mn)}. Genel medyan: ${fmtDur(W.medReply)}.`, true), el("div", "grow"));
    K.gfx.rankBars(root, s.map((p, i) => ({ label: p.name, text: fmtDur(p.medReply), pct: Math.max(8, (mn / Math.max(p.medReply, 1)) * 100), hi: i === 0 }))); root.append(el("div", "grow"));
  } });
  const awardsSlide = (W) => ({ t: "t-review", dur: 9, r(root) {
    root.append(say("Ödül töreni"), say("Bu yılın sohbet ödülleri sahiplerini buldu.", true), el("div", "grow"));
    const g = el("div", "awards"); W.awards.forEach((a) => { const c = el("div", "award"); c.append(el("b", "", a.k), el("span", "", a.who), el("small", "", a.v)); g.append(c); }); root.append(g, el("div", "grow"));
  } });
  const emojiSlide = (W) => ({ t: "t-link", dur: 7, r(root) {
    root.append(say("En çok kullandığınız emojiler"), say(`Toplam ${nf.format(W.emojiTotal)} emoji ve ${nf.format(W.laughTotal)} kahkaha.`, true), el("div", "grow"));
    const g = el("div", "emojis"); W.emojis.forEach((x) => { const c = el("div"); c.append(el("b", "", x.e), el("span", "", nf.format(x.c))); g.append(c); }); root.append(g, el("div", "grow"));
  } });

  /* ---- Ek kartlar (canvas) ---- */
  async function drawAwardsCard(S) {
    const C = K.cards, PL = K.PAL, FG = K.FGC; await C.prepCards(S); const { cv, c } = C.newCard(PL.review); C.deco(c, S, FG.review, 0.13);
    c.fillStyle = FG.review; C.stretch(c, "normal"); c.font = `800 40px ${C.SANS}`; c.fillText(S.brand, C.CM, 328); c.textAlign = "right"; c.font = `600 36px ${C.SANS}`; c.fillText(String(S.year), C.CW - C.CM, 328); c.textAlign = "left";
    C.stretch(c, "expanded"); c.font = `900 96px ${C.DISP}`; c.fillText("Ödül töreni", C.CM - 4, 450);
    const rowH = 152; S.awards.forEach((a, i) => {
      const y = 520 + i * (rowH + 14); c.fillStyle = PL.paper; C.rr(c, C.CM, y, C.CW - C.CM * 2, rowH, 36);
      c.fillStyle = PL.ink; C.stretch(c, "expanded"); c.font = `900 40px ${C.DISP}`; c.fillText(a.k, C.CM + 36, y + 62);
      C.stretch(c, "normal"); c.font = `800 46px ${C.SANS}`; const nm = a.who.length > 22 ? a.who.slice(0, 21) + "…" : a.who; c.fillText(nm, C.CM + 36, y + 118);
      c.textAlign = "right"; c.font = `700 32px ${C.SANS}`; c.globalAlpha = 0.75; c.fillText(a.v, C.CW - C.CM - 36, y + 118); c.globalAlpha = 1; c.textAlign = "left";
    });
    C.foot(c, FG.review); return cv;
  }
  async function drawPeopleCard(S) {
    const C = K.cards, PL = K.PAL, FG = K.FGC; await C.prepCards(S); const { cv, c } = C.newCard(PL.ink); C.deco(c, S, FG.ink, 0.07); C.head(c, S, FG.ink);
    C.stretch(c, "expanded"); c.fillStyle = FG.ink; c.font = `900 84px ${C.DISP}`; c.fillText("Kim ne kadar yazıyor?", C.CM - 4, 440 - 0, 936); 
    const ps = S.people.slice(0, 6), mx = ps[0].n; ps.forEach((p, i) => {
      const y = 540 + i * 150; C.stretch(c, "normal"); c.fillStyle = FG.ink; c.font = `800 44px ${C.SANS}`; c.fillText(p.name.length > 20 ? p.name.slice(0, 19) + "…" : p.name, C.CM, y + 44);
      c.textAlign = "right"; c.font = `700 36px ${C.SANS}`; c.globalAlpha = 0.85; c.fillText(`${nf.format(p.n)} mesaj, %${pct(p.share)}`, C.CW - C.CM, y + 44); c.globalAlpha = 1; c.textAlign = "left";
      c.fillStyle = K.fgA("ink", 0.16); C.rr(c, C.CM, y + 66, C.CW - C.CM * 2, 30, 15); c.fillStyle = PL[PCOL[i]] || PCOL[i]; C.rr(c, C.CM, y + 66, Math.max(30, (C.CW - C.CM * 2) * (p.n / mx)), 30, 15);
    });
    C.foot(c, FG.ink); return cv;
  }

  /* ---- İkonlar ---- */
  const svg = (p, f = "currentColor") => `<svg viewBox="0 0 24 24" fill="${f}" ${f === "none" ? 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : ""}>${p}</svg>`;
  const BUBBLE = svg('<path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>');
  const ICON_SET = {
    "Gece Kuşları": svg('<path d="M20.6 14.4A9 9 0 0 1 9.6 3.4a9 9 0 1 0 11 11z"/>'), "Sabah Grubu": svg('<circle cx="12" cy="12" r="4.4"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M5.2 18.8l1.7-1.7M17.1 6.9l1.7-1.7"/>', "none"),
    "Anlık Yazışanlar": svg('<path d="M13.6 1.8 4.4 13.6h6.4l-1.1 8.6 9.9-12.2h-6.5z"/>'), "Emoji Fabrikası": svg('<circle cx="12" cy="12" r="9.5"/><path d="M8 14.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4M8.8 9.5h.01M15.2 9.5h.01"/>', "none"),
    "Kahkaha Grubu": svg('<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5h9a4.5 4.5 0 0 1-9 0zM8.8 9h.01M15.2 9h.01"/>', "none"), "Uzun Mektuplaşanlar": svg('<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/>', "none"),
    "Aralıksız Sohbet": svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', "none"), "Hafta Sonu Sohbeti": svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', "none"),
    "Dengeli Dostluk": BUBBLE,
  };
  ICON_SET.default = BUBBLE;

  Wrapped.register({
    id: "whatsapp", name: "WhatsApp Wrapped", brand: "WhatsApp Wrapped", color: "#075E54", fg: "#E9FBEF", icon: BUBBLE,
    blurb: "Sohbetinin yılı: kim yazıyor, kim cevap veriyor, ödüller.", hashtags: "#WhatsAppWrapped #Sohbet", persistUrl: false,
    input: { kind: "file", accept: ".txt,.zip,text/plain,application/zip", dropTitle: "Sohbet dosyasını buraya bırak ya da seç", dropHint: ".txt veya .zip. Dosyan cihazından çıkmaz, tarayıcıda işlenir.",
      how: ["WhatsApp'ta sohbeti aç, üstteki ada dokun.", "\"Sohbeti dışa aktar\" (Android'de üç nokta, Daha fazla) seçeneğini seç.", "\"Medyasız\" olarak dışa aktar ve dosyayı buraya yükle (iPhone'da .zip gelir, onu da okuruz)."],
      options: [{ id: "anon", label: "Kişi adlarını takma adla göster (Kişi 1, Kişi 2…). Paylaşmadan önce önerilir.", def: false }, { id: "words", label: "Kelime kartını dahil et (özel kelimeler görünebilir)", def: false }],
      demoLabel: "Önce örnek bir sohbete bak" },
    theme: { id: "whatsapp", skin: "chat", motif: "bubbles", wipe: "circles", css: "theme-whatsapp.css", display: '"Nunito","Trebuchet MS",sans-serif', sans: '"Nunito",system-ui,sans-serif', fontCheck: ['900 80px "Nunito"', '700 30px "Nunito"'],
      colors: { merge: "#075E54", open: "#25D366", closed: "#FF7A59", review: "#FFF1B8", link: "#34B7F1", ink: "#0B141A", paper: "#ECE5DD" },
      fg: { merge: "#E9FBEF", open: "#0B141A", closed: "#1F0E08", review: "#1F2A24", link: "#06222E", ink: "#E9FBEF" } },
    icons: ICON_SET,
    vocab: { noun: "mesaj", plPoss: "mesajlarınızın", doVerb: "yazdınız", doVerb1: "yazdık", activeVerb: "mesajlaştınız", noBreak: "hiç ara vermediniz", dayPoss: "gününüzün", weekdayVerb: "yazışıyorsunuz",
      night: "Gece kuşlarısınız.", morning: "Sabah grubusunuz.", evening: "Akşamcısınız.", day: "Gündüz grubusunuz.", hoursLead: "En çok yazıştığınız saat", streakLead: "En uzun serimiz", streakLine: "gün üst üste yazıştınız", streakLine1: "gün üst üste yazıştık", introTail1: "sohbet yılımız", streakLead1: "En uzun serimiz", curStreak: "Şu an aktif serimiz",
      busyLead: "En yoğun gününüz", skyLead: "Sohbetiniz bir şehir olsaydı", skyTitle: "Sohbet şehriniz", skyCard: "sohbet şehrimiz", skyName: "Sohbet şehri", introTail: "sohbet yılınız", personaLead: "Sohbet kişiliğiniz", personaLead1: "Sohbet kişiliğimiz", cardLead: "Sohbet kartınız hazır.", cardLead1: "Sohbet kartımız", cardWho: "olarak yazışıyorsunuz", devName: "Sohbet kartı" },
    async inspect(file) {
      let text; try { text = await readText(file); } catch { throw mkErr("badfile"); }
      const msgs = parseChat(text); if (msgs.length < 20) throw mkErr("badfile");
      const yc = {}; msgs.forEach((m) => { const y = new Date(m.t).getFullYear(); yc[y] = (yc[y] || 0) + 1; });
      const years = Object.entries(yc).map(([y, n]) => ({ y: +y, n })).sort((a, b) => b.y - a.y), people = new Set(msgs.map((m) => m.who)).size, first = new Date(msgs[0].t), last = new Date(msgs[msgs.length - 1].t);
      const def = years.filter((y) => y.n >= 100).sort((a, b) => b.y - a.y)[0] || years.sort((a, b) => b.n - a.n)[0];
      return { messages: msgs, title: titleOf(file.name), years, defaultYear: def.y, note: `${nf.format(msgs.length)} mesaj, ${people} kişi. ${first.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} ile ${last.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} arası.` };
    },
    async load(input, ctx) { ctx.step("Sohbet çözümleniyor"); await wait(250); return { year: ctx.year, title: input.meta.title, messages: input.meta.messages }; },
    analyze, isEmpty: (W) => W.nMsg < 20,
    slides(W) {
      const L = [SL.intro(W)]; const sf = (n) => Wrapped.kit.sceneFor(W, n);
      if (W.hasCal && W.total > 0) { const a = SL.activity(W); L.push(a[0], whoSlide(W), ...a.slice(1)); } else L.push(whoSlide(W));
      if (W.hours) L.push(SL.hours(W));
      if (W.starters.length >= 2) L.push(startSlide(W));
      if (W.repliers.length >= 2) L.push(replySlide(W), ...[sf("pingpong")].filter(Boolean));
      if (W.awards.length >= 3) L.push(awardsSlide(W));
      if (W.emojis.length >= 3) L.push(sf("emojirain") || emojiSlide(W));
      if (W.wordsCard) L.push(SL.words(W));
      if (W.hasCal && W.total > 0) L.push(SL.skyline(W));
      L.push(SL.roast(W), SL.persona(W), SL.cardReveal(W), SL.studio(W));
      return L;
    },
    extraCards(S) { return [["awards", "Ödüller", drawAwardsCard, S.awards.length >= 3], ["people", "Kim yazıyor", drawPeopleCard, S.people.length >= 2]]; },
    caption(W, url) { return `${W.year} WhatsApp Wrapped'ımız 💬\n${nf.format(W.nMsg)} mesaj · ${W.people.length} kişi · ${W.persona.k}\nSohbet kartımız: ${W.overall} güç (${W.rarity})\n\nSen de dene: ${url}\n\n#WhatsAppWrapped #Sohbet #${W.year}`; },
    errMsg(e) { if (e.code === "badfile") return "Bu dosya WhatsApp sohbet dışa aktarımı gibi görünmüyor. Sohbeti \"medyasız\" dışa aktarıp .txt ya da .zip olarak yükle."; if (e.code === "empty") return "Seçilen yılda yeterli mesaj bulunamadı. Başka bir yıl dene."; return null; },
  });
})();
