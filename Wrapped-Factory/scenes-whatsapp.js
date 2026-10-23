/* WhatsApp sahneleri: cevap pinpon'u (gerçek medyan süreye göre) ve emoji yağmuru (gerçek sayılara göre). İçerik hiç gösterilmez, yalnızca iskelet satırlar. */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, back, rr, txt, rand } = L, nf = K.nf;
  const fmtDur = (s) => (s < 60 ? `${Math.round(s)} sn` : s < 3600 ? `${Math.round(s / 60)} dk` : `${Math.floor(s / 3600)} sa ${Math.round((s % 3600) / 60)} dk`);
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function pingpong(W) {
    const A = (W.repliers && W.repliers[0]) || W.people[0], B = (W.repliers && W.repliers[1]) || W.people[1] || W.people[0], med = W.medReply || 60;
    const gap = clamp(0.4 + Math.log10(1 + med) * 0.42, 0.55, 1.9), STEP = gap + 0.55, N = 9, TOTAL = 0.8 + N * STEP + 1.6, R = rand(11);
    const spec = Array.from({ length: N }, () => ({ w1: 0.5 + R() * 0.45, w2: 0.25 + R() * 0.5, two: R() < 0.5 }));
    return (c, w, h, t0, cs) => {
      const t = t0 % TOTAL, u = w / 100, top = u * 15, bot = u * 4, hs = spec.map((s) => (s.two ? u * 14 : u * 9.4)), tk = (k) => 0.8 + k * STEP;
      // üstte iki kişi
      [[A, u * 4, "left"], [B, w - u * 4, "right"]].forEach(([p, x, al]) => {
        const cx = al === "left" ? x + u * 4.2 : x - u * 4.2; c.fillStyle = al === "left" ? cs.pal.paper : cs.pal.open; c.beginPath(); c.arc(cx, u * 6, u * 4.2, 0, 6.283); c.fill();
        txt(c, L.ini(p.name), cx, u * 7.6, { size: u * 5, font: cs.disp, w: 800, color: al === "left" ? cs.pal.ink : cs.f.open, align: "center" });
        txt(c, L.cut(c, p.name, u * 30, `700 ${u * 3.6}px ${cs.sans}`), al === "left" ? x + u * 9.2 : x - u * 9.2, u * 7.2, { size: u * 3.6, font: cs.sans, w: 700, color: cs.fg, align: al });
      });
      let total = 0; for (let k = 0; k < N; k++) total += (hs[k] + u * 2.2) * out3(seg(t, tk(k), 0.28));
      const typing = Math.floor((t - 0.8 + gap * 0.75) / STEP) , scroll = Math.max(0, total + u * 11 - (h - top - bot));
      c.save(); c.beginPath(); c.rect(0, top - u * 2, w, h - top + u * 2); c.clip(); c.translate(0, -scroll);
      let y = top;
      for (let k = 0; k < N; k++) {
        const left = k % 2 === 0, bw = u * (left ? 64 : 58), x = left ? u * 4 : w - u * 4 - bw, p = out3(seg(t, tk(k), 0.28)), tt = tk(k);
        const showTyping = t >= tt - gap * 0.75 && t < tt;
        if (showTyping) {
          const e = out3(seg(t, tt - gap * 0.75, 0.2)); c.globalAlpha = e; c.fillStyle = left ? cs.pal.paper : cs.pal.open; rr(c, x, y, u * 15, u * 8, u * 4); c.fill();
          for (let d = 0; d < 3; d++) { c.fillStyle = left ? cs.pal.ink : cs.f.open; c.globalAlpha = e * (0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 7 - d * 0.9))); c.beginPath(); c.arc(x + u * (4.2 + d * 3.3), y + u * 4, u * 0.95, 0, 6.283); c.fill(); }
          c.globalAlpha = 1; break;
        }
        if (p <= 0) break;
        const bhk = hs[k], sc = lerp(0.82, 1, back(p)); c.save(); c.globalAlpha = p; c.translate(left ? x : x + bw, y + bhk); c.scale(sc, sc); c.translate(left ? -x : -(x + bw), -(y + bhk));
        c.fillStyle = left ? cs.pal.paper : cs.pal.open; rr(c, x, y, bw, bhk, u * 3); c.fill();
        c.fillStyle = left ? cs.pal.ink : cs.f.open; c.globalAlpha = p * 0.5; rr(c, x + u * 3, y + u * 2.6, (bw - u * 14) * spec[k].w1, u * 1.5, u * 0.75); c.fill(); if (spec[k].two) { rr(c, x + u * 3, y + u * 5.8, (bw - u * 14) * spec[k].w2, u * 1.5, u * 0.75); c.fill(); }
        const tickY = y + bhk - u * 2.6, blue = t > tt + 0.6; c.globalAlpha = p; c.strokeStyle = blue ? "#34B7F1" : left ? cs.pal.ink : cs.f.open; c.lineWidth = u * 0.5; c.lineCap = "round"; if (!blue) c.globalAlpha = p * 0.5;
        const tx0 = x + bw - u * 6.4; L.check(c, tx0, tickY, u * 2); c.stroke(); L.check(c, tx0 + u * 1.7, tickY, u * 2); c.stroke(); c.restore();
        y += bhk + u * 2.2;
      }
      c.restore();
    };
  }

  function emojiRain(W) {
    const em = W.emojis.slice(0, 6), mx = em[0].c, R = rand(5), drops = [];
    em.forEach((e) => { const n = 3 + Math.round((11 * e.c) / mx); for (let k = 0; k < n; k++) drops.push({ e: e.e, x: R(), v: 0.1 + R() * 0.14, ph: R(), s: 0.075 + 0.05 * (e.c / mx) + R() * 0.02, sw: R() * 6.283 }); });
    return (c, w, h, t, cs) => {
      const fade = out3(seg(t, 0, 0.8)); c.save(); c.globalAlpha = fade; c.textAlign = "center"; c.textBaseline = "middle";
      for (const d of drops) { const y = (((d.ph + t * d.v) % 1.2) * h * 1.2) - h * 0.1, x = d.x * w + Math.sin(t * 1.1 + d.sw) * w * 0.015; c.font = `${Math.round(d.s * w)}px ${EMOJI_FONT}`; c.fillText(d.e, x, y); }
      c.restore();
      const n = em.length, pw = w * 0.9, ph = w * 0.17, px = (w - pw) / 2, py = h - ph - w * 0.02; c.fillStyle = cs.pal.ink; c.globalAlpha = 0.85 * fade; rr(c, px, py, pw, ph, ph * 0.3); c.fill(); c.globalAlpha = fade;
      em.forEach((e, i) => { const cx = px + (pw / n) * (i + 0.5); c.font = `${Math.round(ph * 0.42)}px ${EMOJI_FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText(e.e, cx, py + ph * 0.38); txt(c, nf.format(e.c), cx, py + ph * 0.86, { size: ph * 0.2, font: cs.sans, w: 800, color: cs.f.ink, align: "center" }); });
      c.globalAlpha = 1;
    };
  }

  const sc = {
    pingpong: (W) => ({ id: "whatsapp.pingpong", t: "t-closed", lead: "Cevap pinpon'u", big: { text: fmtDur(W.medReply || 0), f: null }, bigSize: 26, sub: "Medyan cevap süresi. Mesajlar gerçek sürelere göre geliyor, içerikleri görünmez.", dur: 8, still: 6.2, slot: "closed", draw: pingpong(W) }),
    emojirain: (W) => ({ id: "whatsapp.emojirain", t: "t-link", lead: "Emoji yağmuru", big: { v: W.emojiTotal, f: nf.format }, sub: `${nf.format(W.laughTotal)} kahkaha ve en çok kullanılan ${Math.min(6, W.emojis.length)} emoji.`, dur: 6, still: 3, slot: "link", draw: emojiRain(W) }),
    reel: (W) => [sc.pingpong(W)],
  };
  Wrapped.scenes.whatsapp = sc;
})();
