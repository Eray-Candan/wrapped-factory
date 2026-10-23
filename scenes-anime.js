/* Anime sahneleri: manga paneli düzeni ve güç ölçer (scouter). */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, io, back, rr, txt } = L, nf = K.nf;

  function panels(W) {
    const hrs = Math.round(W.hoursTotal), nice = [50, 100, 200, 300, 500, 1000, 2000, 5000].find((x) => x >= hrs) || hrs * 1.2;
    return (c, w, h, t, cs) => {
      const g = w * 0.02, u = w / 100, poly = [[[0, 0], [w, 0], [w, h * 0.36], [0, h * 0.44]], [[0, h * 0.44 + g], [w * 0.55, h * 0.36 + g], [w * 0.47, h], [0, h]], [[w * 0.55 + g, h * 0.36 + g], [w, h * 0.36 + g], [w, h], [w * 0.47 + g, h]]];
      const col = [cs.pal.open, cs.pal.review, cs.pal.merge], fgc = [cs.f.open, cs.f.review, cs.f.merge], ctr = [[w * 0.5, h * 0.2], [w * 0.24, h * 0.72], [w * 0.76, h * 0.68]];
      poly.forEach((pts, i) => {
        const st = 0.3 + i * 0.9, p = out3(seg(t, st, 0.45)); if (p <= 0) return; c.save(); c.beginPath(); c.rect(0, 0, w * p + 1, h); c.clip();
        c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = col[i]; c.fill(); c.save(); c.clip();
        const [cx, cy] = ctr[i]; c.strokeStyle = fgc[i]; c.globalAlpha = 0.16; c.lineWidth = u * 0.5; for (let k = 0; k < 28; k++) { const a = (k / 28) * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * u * 14, cy + Math.sin(a) * u * 14); c.lineTo(cx + Math.cos(a) * u * 80, cy + Math.sin(a) * u * 80); c.stroke(); } c.globalAlpha = 1;
        const slam = 1 + (1 - back(seg(t, st + 0.2, 0.4))) * 0.4, a = seg(t, st + 0.15, 0.2);
        c.translate(cx, cy); c.scale(slam, slam); c.globalAlpha = a;
        if (i === 0) { txt(c, "BÖLÜM", 0, -u * 8.5, { size: u * 5, font: cs.sans, w: 800, color: fgc[i], align: "center", al: 0.85 }); const s = L.fit(c, nf.format(W.episodes), u * 70, u * 20, cs.disp, 900); txt(c, nf.format(Math.round(W.episodes * out3(seg(t, st + 0.2, 1.1)))), 0, u * 6, { size: s, font: cs.disp, w: 900, color: fgc[i], align: "center" }); }
        if (i === 1) { const r = u * 15, prog = clamp(hrs / nice) * io(seg(t, st + 0.2, 1.4)); c.lineWidth = u * 3.4; c.strokeStyle = fgc[i]; c.globalAlpha = a * 0.25; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke(); c.globalAlpha = a; c.lineCap = "round"; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + 6.283 * prog); c.stroke(); txt(c, nf.format(Math.round(hrs * io(seg(t, st + 0.2, 1.4)))), 0, u * 1.8, { size: L.fit(c, nf.format(hrs), r * 1.5, u * 9, cs.disp, 900), font: cs.disp, w: 900, color: fgc[i], align: "center" }); txt(c, "SAAT", 0, r + u * 7, { size: u * 4.4, font: cs.sans, w: 800, color: fgc[i], align: "center" }); }
        if (i === 2) { c.fillStyle = "#fff"; c.globalAlpha = a * 0.35; L.star(c, 0, -u * 2, u * 21, u * 13, 12); c.fill(); c.globalAlpha = a; txt(c, nf.format(W.nAnime), 0, u * 3.6, { size: L.fit(c, nf.format(W.nAnime), u * 22, u * 15, cs.disp, 900), font: cs.disp, w: 900, color: fgc[i], align: "center" }); txt(c, "ANIME", 0, u * 11, { size: u * 5, font: cs.sans, w: 800, color: fgc[i], align: "center" }); }
        c.restore(); c.restore();
        c.save(); c.beginPath(); c.rect(0, 0, w * p + 1, h); c.clip(); c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.lineWidth = u * 1.3; c.strokeStyle = cs.pal.ink; c.lineJoin = "miter"; c.stroke(); c.restore();
      });
      const sfx = seg(t, 3.4, 0.25); if (sfx > 0) { c.save(); c.translate(w * 0.74, h * 0.14); c.rotate(-0.12); c.scale(back(sfx), back(sfx)); c.fillStyle = "#fff"; L.star(c, 0, 0, u * 18, u * 12, 10); c.fill(); c.lineWidth = u * 0.9; c.strokeStyle = cs.pal.ink; c.stroke(); txt(c, "BAAM!", 0, u * 2.6, { size: u * 8, font: cs.disp, w: 900, color: cs.pal.ink, align: "center" }); c.restore(); }
    };
  }

  function scouter(W) {
    const hrs = W.hoursTotal, nice = [50, 100, 200, 300, 500, 1000, 2000, 5000].find((x) => x >= hrs) || hrs * 1.2, ratio = clamp(hrs / nice);
    return (c, w, h, t, cs) => {
      const u = w / 100, x0 = w * 0.28, tw = w * 0.2, y0 = h * 0.07, th = h * 0.86, prog = io(seg(t, 0.3, 2.8)), lvl = th * ratio * prog;
      c.fillStyle = "rgba(0,0,0,.28)"; rr(c, x0, y0, tw, th, tw * 0.3); c.fill();
      c.save(); rr(c, x0, y0, tw, th, tw * 0.3); c.clip(); const gr = c.createLinearGradient(0, y0 + th, 0, y0); gr.addColorStop(0, cs.pal.open); gr.addColorStop(1, cs.pal.review); c.fillStyle = gr; c.fillRect(x0, y0 + th - lvl, tw, lvl); c.restore();
      c.strokeStyle = cs.fg; c.lineWidth = u * 0.9; rr(c, x0, y0, tw, th, tw * 0.3); c.stroke();
      for (let i = 0; i <= 5; i++) { const y = y0 + th - (th * i) / 5 * (1 / 1); c.lineWidth = u * 0.45; c.globalAlpha = 0.7; c.beginPath(); c.moveTo(x0 - u * 2.2, y); c.lineTo(x0, y); c.stroke(); c.globalAlpha = 1; txt(c, nf.format(Math.round((nice * i) / 5)), x0 - u * 3.2, y + u * 1.4, { size: u * 3.6, font: cs.sans, w: 700, color: cs.fg, align: "right", al: 0.85 }); }
      const ly = y0 + th - lvl, val = Math.round(hrs * prog);
      c.fillStyle = cs.fg; c.beginPath(); c.moveTo(x0 + tw, ly); c.lineTo(x0 + tw + u * 5, ly - u * 3); c.lineTo(x0 + tw + u * 5, ly + u * 3); c.closePath(); c.fill();
      txt(c, nf.format(val), x0 + tw + u * 7, ly + u * 4, { size: L.fit(c, nf.format(Math.round(hrs)), w - (x0 + tw + u * 9), u * 13, cs.disp, 900), font: cs.disp, w: 900, color: cs.fg });
      txt(c, "GÜÇ SEVİYESİ", x0 + tw + u * 7, ly + u * 10, { size: u * 3.6, font: cs.sans, w: 800, color: cs.fg, al: 0.85 });
      if (prog >= 1) { const e = seg(t, 3.2, 0.4); c.strokeStyle = cs.fg; c.lineWidth = u * 0.7; c.globalAlpha = 0.55 * e * (0.7 + 0.3 * Math.sin(t * 3)); for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; c.beginPath(); c.moveTo(x0 + tw / 2 + Math.cos(a) * tw * 0.9, y0 + th - lvl + Math.sin(a) * tw * 0.9); c.lineTo(x0 + tw / 2 + Math.cos(a) * tw * 1.5, y0 + th - lvl + Math.sin(a) * tw * 1.5); c.stroke(); } c.globalAlpha = 1; }
    };
  }

  const sc = {
    panels: (W) => ({ id: "anime.panels", t: "t-closed", lead: "Yılın üç karesi", sub: "Bölümlerin, saatlerin ve animelerin bir manga sayfasında.", dur: 5, still: 4.6, slot: "closed", draw: panels(W) }),
    scouter: (W) => ({ id: "anime.scouter", t: "t-link", lead: "Toplam izleme süren", big: { v: Math.round(W.hoursTotal), f: nf.format }, sub: `${nf.format(W.nAnime)} anime, ${nf.format(W.episodes)} bölüm. Güç ölçer yükseliyor.`, dur: 6.2, still: 5, slot: "link", draw: scouter(W) }),
    reel: (W) => [sc.panels(W)],
  };
  Wrapped.scenes.anime = sc;
})();
