/* Takım sahneleri: katkıcıların koşu yarışı ve skor tabelası (flip) toplamı. */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, io, rr, txt } = L, nf = K.nf, MEDAL = ["#F5C242", "#C9D1D9", "#CD7F32"];

  function race(W) {
    const P = W.people.slice(0, 6), mx = P[0].n;
    return (c, w, h, t, cs) => {
      const u = w / 100, lh = (h - u * 4) / P.length, x0 = w * 0.31, x1 = w * 0.76, run = io(seg(t, 0.5, 3.4));
      for (let i = 0; i < P.length; i++) {
        const y = u * 2 + i * lh, cy = y + lh / 2, p = P[i], prog = (p.n / mx) * run;
        c.fillStyle = "rgba(0,0,0,.2)"; c.globalAlpha = i % 2 ? 0.5 : 1; rr(c, 0, y + lh * 0.08, w, lh * 0.84, lh * 0.2); c.fill(); c.globalAlpha = 1;
        txt(c, L.cut(c, p.name, w * 0.24, `800 ${lh * 0.24}px ${cs.sans}`), u * 3, cy + lh * 0.09, { size: lh * 0.26, font: cs.sans, w: 800, color: cs.fg });
        c.fillStyle = cs.fg; c.globalAlpha = 0.35; c.fillRect(x0, cy - 1, x1 - x0, 2); c.globalAlpha = 1;
        const rx = x0 + (x1 - x0) * prog, r = lh * 0.34, col = MEDAL[i] || cs.pal.link; c.fillStyle = col; c.beginPath(); c.arc(rx, cy, r, 0, 6.283); c.fill(); c.lineWidth = u * 0.5; c.strokeStyle = cs.pal.ink; c.stroke();
        txt(c, L.ini(p.name), rx, cy + r * 0.36, { size: r * 1.05, font: cs.disp, w: 900, color: "#111", align: "center" });
        txt(c, nf.format(Math.round(p.n * run)), w - u * 3, cy + lh * 0.09, { size: lh * 0.28, font: cs.disp, w: 800, color: cs.fg, align: "right" });
        if (i === 0 && t > 3.9) { const e = out3(seg(t, 3.9, 0.35)); c.save(); c.translate(rx, cy - r * 1.25); c.scale(e, e); c.fillStyle = MEDAL[0]; c.beginPath(); c.moveTo(-r * 0.7, 0); c.lineTo(-r * 0.7, -r * 0.7); c.lineTo(-r * 0.3, -r * 0.3); c.lineTo(0, -r * 0.8); c.lineTo(r * 0.3, -r * 0.3); c.lineTo(r * 0.7, -r * 0.7); c.lineTo(r * 0.7, 0); c.closePath(); c.fill(); c.restore(); }
      }
      c.fillStyle = cs.fg; for (let k = 0; k < P.length * 2; k++) { c.globalAlpha = k % 2 ? 0.9 : 0.25; c.fillRect(x1 + u * 3, u * 2 + (k * lh) / 2, u * 1.4, lh / 2); } c.globalAlpha = 1;
    };
  }

  function flip(W) {
    const str = nf.format(W.nCommits), chars = [...str];
    return (c, w, h, t, cs) => {
      const n = chars.length, gap = w * 0.02, cw = Math.min((w - gap * (n - 1)) / n, h * 0.5), chh = cw * 1.45, x0 = (w - (cw * n + gap * (n - 1))) / 2, y0 = (h - chh) / 2;
      chars.forEach((ch, i) => {
        const x = x0 + i * (cw + gap); if (!/\d/.test(ch)) { txt(c, ch, x + cw / 2, y0 + chh * 0.8, { size: cw * 0.7, font: cs.disp, w: 900, color: cs.fg, align: "center" }); return; }
        const target = +ch, start = 0.3 + i * 0.22, steps = 6, STEP = 0.2, k = clamp(Math.floor((t - start) / STEP), -1, steps), pr = k < 0 ? 0 : k >= steps ? 1 : ((t - start) / STEP) % 1;
        const seq = (j) => (j >= steps ? target : (target + 3 + j * 3) % 10), cur = k < 0 ? 0 : seq(Math.min(k, steps - 1)), nxt = k >= steps ? target : seq(Math.min(k + 1, steps - 1)), done = k >= steps;
        const half = (d, top, sy) => { c.save(); c.beginPath(); c.rect(x, top ? y0 : y0 + chh / 2, cw, chh / 2); c.clip(); c.translate(x + cw / 2, y0 + chh / 2); c.scale(1, sy); c.translate(-(x + cw / 2), -(y0 + chh / 2)); c.fillStyle = cs.pal.ink; rr(c, x, y0, cw, chh, cw * 0.1); c.fill(); txt(c, String(d), x + cw / 2, y0 + chh * 0.74, { size: chh * 0.78, font: cs.disp, w: 900, color: cs.f.ink, align: "center" }); c.restore(); };
        if (done || k < 0) { half(done ? target : cur, true, 1); half(done ? target : cur, false, 1); }
        else { half(nxt, true, 1); half(cur, false, 1); if (pr < 0.5) half(cur, true, 1 - pr * 2); else half(nxt, false, (pr - 0.5) * 2); }
        c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(x, y0 + chh / 2 - 1.5, cw, 3);
      });
    };
  }

  const sc = {
    flip: (W) => ({ id: "team.flip", t: "t-ink", lead: "Skor tabelası", sub: `${nf.format(W.people.length)} katkıcı, ${nf.format(W.repoCount)} depo. Bu yılın toplam commit sayısı.`, dur: 3.4, still: 3.4, slot: "ink", draw: flip(W), slide: 6 }),
    race: (W) => ({ id: "team.race", t: "t-link", lead: "Commit yarışı", sub: `${W.people[0].name} bitiş çizgisine ilk ulaşan.`, dur: 5, still: 4.6, slot: "link", draw: race(W), slide: 8 }),
    reel: (W) => [sc.race(W)],
  };
  Wrapped.scenes.team = sc;
})();
