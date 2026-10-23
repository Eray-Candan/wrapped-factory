/* GitHub sahnesi: yılın "git graph"ı. Ay ay commit yoğunluğu, yoğun aylarda dallar ve en uzun seri. */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, io, back, rr, txt } = L, nf = K.nf, M = ["O", "Ş", "M", "N", "M", "H", "T", "A", "E", "E", "K", "A"];

  function graph(W) {
    const mo = W.month || Array(12).fill(0), mx = Math.max(...mo, 1), avg = mo.reduce((a, b) => a + b, 0) / 12, days = Math.max(W.days.length, 1), hash = ((W.total * 2654435761) >>> 0).toString(16).slice(0, 7);
    return (c, w, h, t, cs) => {
      const u = w / 100, pad = u * 7, x = (i) => pad + (i * (w - 2 * pad)) / 11, y0 = h * 0.62, line = io(seg(t, 0.2, 2.6)), reach = pad + (w - 2 * pad) * line;
      c.strokeStyle = cs.fg; c.lineWidth = u * 0.9; c.lineCap = "round"; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(pad, y0); c.lineTo(reach, y0); c.stroke(); c.globalAlpha = 1;
      if (W.best && W.best.len >= 2) { const xs = pad + ((W.best.s) / days) * (w - 2 * pad), xe = pad + ((W.best.e + 1) / days) * (w - 2 * pad), e = seg(t, 2.2, 0.6); c.strokeStyle = cs.pal.review; c.lineWidth = u * 2; c.beginPath(); c.moveTo(xs, y0); c.lineTo(lerp(xs, xe, e), y0); c.stroke(); txt(c, `seri: ${W.best.len} gün`, (xs + xe) / 2, y0 + u * 11.5, { size: u * 3.6, font: cs.sans, w: 800, color: cs.pal.review, align: "center", al: e }); }
      mo.forEach((n, i) => {
        const px = x(i), appear = seg(reach - px, 0, u * 4), p = back(appear); txt(c, M[i], px, y0 + u * 7, { size: u * 4, font: cs.sans, w: 800, color: cs.fg, align: "center", al: 0.75 * appear });
        if (n > avg * 1.1 && appear > 0) { const hh = u * (9 + 20 * (n / mx)), sp = (w - 2 * pad) / 11 * 0.4, e = out3(seg(t, 0.8 + i * 0.16, 0.7)); c.strokeStyle = cs.pal.review; c.lineWidth = u * 0.7; c.globalAlpha = 0.95; c.beginPath(); c.moveTo(px - sp, y0); c.bezierCurveTo(px - sp * 0.6, y0 - hh * e, px + sp * 0.6, y0 - hh * e, px + sp, y0); c.stroke(); c.fillStyle = cs.pal.review; c.beginPath(); c.arc(px, y0 - hh * e * 0.75, u * 1.2 * e, 0, 6.283); c.fill(); c.globalAlpha = 1; }
        if (appear > 0) { const r = u * (0.9 + 2.3 * Math.sqrt(n / mx)) * p; c.fillStyle = cs.bg; c.beginPath(); c.arc(px, y0, r + u * 0.7, 0, 6.283); c.fill(); c.fillStyle = cs.fg; c.beginPath(); c.arc(px, y0, r, 0, 6.283); c.fill(); }
      });
      const hd = seg(t, 2.9, 0.5); if (hd > 0) { c.save(); c.globalAlpha = hd; const tx = w - pad, ty = y0 - u * 10; c.font = `800 ${u * 3.6}px ${cs.sans}`; const label = `HEAD → main  ${hash}`, tw = c.measureText(label).width + u * 5; c.fillStyle = cs.fg; rr(c, tx - tw + u * 3, ty - u * 4.2, tw, u * 7, u * 1.4); c.fill(); txt(c, label, tx + u * 0.5, ty + u * 0.4, { size: u * 3.6, font: cs.sans, w: 800, color: cs.bg, align: "right" }); c.restore(); }
    };
  }
  const sc = {
    graph: (W) => ({ id: "github.graph", t: "t-ink", lead: "Yılın git graph'ı", big: { v: W.total, f: nf.format }, bigSize: 30, sub: "Her nokta bir ayın commit yoğunluğu, dallar da en hareketli aylar.", dur: 4, still: 4, slot: "ink", draw: graph(W) }),
    reel: (W) => [sc.graph(W)],
  };
  Wrapped.scenes.github = sc;
})();
