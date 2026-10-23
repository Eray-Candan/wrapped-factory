/* Film sahneleri: geri sayım şeridi (leader) ve kayan film bandı. */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, io, rr, txt } = L, nf = K.nf;
  const stars = (c, x, y, r, n, col) => { for (let i = 0; i < n; i++) { c.fillStyle = col; L.star(c, x + i * r * 2.3, y, r, r * 0.45, 5); c.fill(); } };

  function leader(W) {
    return (c, w, h, t, cs) => {
      const R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2, u = w / 100, num = t < 1.8 ? 3 : t < 3.6 ? 2 : t < 5.4 ? 1 : 0, reveal = out3(seg(t, 5.4, 0.8));
      c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.arc(cx, cy, R, 0, 6.283); c.fill(); c.strokeStyle = cs.fg; c.lineWidth = u * 0.8; c.globalAlpha = 0.85; [R, R * 0.82].forEach((r) => { c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.stroke(); });
      c.beginPath(); c.moveTo(cx - R * 1.12, cy); c.lineTo(cx + R * 1.12, cy); c.moveTo(cx, cy - R * 1.12); c.lineTo(cx, cy + R * 1.12); c.stroke(); c.globalAlpha = 1;
      if (num > 0) { const a = (t * 0.55 * 6.283) % 6.283; c.fillStyle = cs.fg; c.globalAlpha = 0.16; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R * 0.99, a - Math.PI / 2 - 1.1, a - Math.PI / 2); c.closePath(); c.fill(); c.globalAlpha = 1; txt(c, String(num), cx, cy + R * 0.3, { size: R * 0.95, font: cs.disp, w: 900, color: cs.fg, align: "center", al: 1 - seg(t % 1.8, 1.5, 0.3) * 0.5 }); }
      if (reveal > 0) { c.fillStyle = cs.pal.ink; c.globalAlpha = 0.55 * reveal; c.beginPath(); c.arc(cx, cy, R * 0.8, 0, 6.283); c.fill(); c.globalAlpha = reveal; const s = L.fit(c, nf.format(W.nFilms), R * 1.35, R * 0.8, cs.disp, 900); txt(c, nf.format(W.nFilms), cx, cy + s * 0.2, { size: s, font: cs.disp, w: 900, color: "#fff", align: "center", al: reveal }); txt(c, "film izledin", cx, cy + R * 0.5, { size: R * 0.17, font: cs.sans, w: 800, color: "#fff", align: "center", al: reveal }); }
    };
  }

  function strip(W) {
    const list = (W.top && W.top.length >= 3 ? W.top : W.films.filter((f) => f.rating).slice(0, 8)).map((f) => ({ name: f.name, r: f.rating, y: f.year })), n = list.length || 1;
    return (c, w, h, t, cs) => {
      const u = w / 100, bandH = h * 0.78, by = (h - bandH) / 2, fw = u * 56, fh = bandH * 0.68, gap = u * 5, step = fw + gap, total = n * step, off = (t * u * 11) % total;
      c.fillStyle = "#0b0808"; c.fillRect(0, by, w, bandH);
      c.fillStyle = "#2c2522"; for (let x = -((off) % (u * 6.4)); x < w; x += u * 6.4) { rr(c, x, by + bandH * 0.05, u * 3.2, bandH * 0.055, u * 0.6); c.fill(); rr(c, x, by + bandH * 0.895, u * 3.2, bandH * 0.055, u * 0.6); c.fill(); }
      for (let rep = -1; rep <= 1; rep++) for (let j = 0; j < n; j++) {
        const x = u * 4 + rep * total + j * step - off, f = list[j]; if (x > w || x + fw < 0) continue; const y = by + (bandH - fh) / 2;
        c.fillStyle = cs.pal.paper; rr(c, x, y, fw, fh, u * 1.6); c.fill(); c.fillStyle = cs.pal.merge; rr(c, x, y, fw, fh * 0.52, u * 1.6); c.fill(); c.fillRect(x, y + fh * 0.4, fw, fh * 0.12);
        txt(c, String(j + 1), x + u * 3.5, y + fh * 0.4, { size: fh * 0.34, font: cs.disp, w: 900, color: cs.f.merge, al: 0.9 });
        const nm = f.name.length > 22 ? f.name.slice(0, 21) + "…" : f.name; c.font = `900 ${u * 4.6}px ${cs.disp}`; const words = nm.split(" "), lines = []; let cur = ""; for (const wd of words) { if (c.measureText((cur + " " + wd).trim()).width > fw - u * 6 && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); } lines.push(cur);
        lines.slice(0, 2).forEach((ln, i) => txt(c, ln, x + u * 3, y + fh * 0.66 + i * u * 5.2, { size: u * 4.6, font: cs.disp, w: 900, color: cs.pal.ink }));
        if (f.r) stars(c, x + u * 3.8, y + fh * 0.92, u * 2, Math.round(f.r), cs.pal.closed);
      }
    };
  }

  const sc = {
    leader: (W) => ({ id: "film.leader", t: "t-ink", lead: "Perde açılıyor", sub: "Üç, iki, bir... ve yılın film sayısı.", dur: 6.5, still: 6.4, slot: "ink", draw: leader(W), slide: 8 }),
    strip: (W) => ({ id: "film.strip", t: "t-review", lead: "Yılın favorileri", big: { text: `${W.top && W.top[0] ? W.top[0].name : ""}` }, bigSize: 14, sub: "En yüksek puan verdiğin filmler, bir film şeridinde.", dur: 8, still: 3, slot: "review", draw: strip(W), slide: 8.5 }),
    reel: (W) => [sc.leader(W)],
  };
  Wrapped.scenes.film = sc;
})();
