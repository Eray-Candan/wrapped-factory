/* Sahne yardımcıları: kolaylaştırma eğrileri, metin ve şekiller. Tüm sahneler bunu kullanır. */
(() => {
  "use strict";
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const L = {
    clamp, lerp: (a, b, t) => a + (b - a) * t, seg: (t, a, d) => clamp((t - a) / d),
    out3: (x) => 1 - (1 - x) ** 3, in3: (x) => x ** 3, io: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
    back: (x) => { const a = 1.70158, b = a + 1; return 1 + b * (x - 1) ** 3 + a * (x - 1) ** 2; },
    rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); },
    txt(c, s, x, y, o = {}) {
      c.save(); c.font = `${o.w || 700} ${o.size || 24}px ${o.font || "sans-serif"}`; c.fillStyle = o.color || "#fff"; c.textAlign = o.align || "left"; c.textBaseline = o.base || "alphabetic"; c.globalAlpha = o.al == null ? 1 : o.al;
      if (o.rot) { c.translate(x, y); c.rotate(o.rot); c.fillText(s, 0, 0); } else c.fillText(s, x, y); c.restore();
    },
    fit(c, s, maxW, size, font, w = 800) { c.font = `${w} ${size}px ${font}`; const m = c.measureText(s).width; return m > maxW ? Math.max(8, Math.floor((size * maxW) / m)) : size; },
    rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
    star(c, cx, cy, r, rin, n) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n - Math.PI / 2, rr_ = i % 2 ? rin : r; i ? c.lineTo(cx + Math.cos(a) * rr_, cy + Math.sin(a) * rr_) : c.moveTo(cx + Math.cos(a) * rr_, cy + Math.sin(a) * rr_); } c.closePath(); },
    check(c, x, y, s) { c.beginPath(); c.moveTo(x - s * 0.5, y); c.lineTo(x - s * 0.12, y + s * 0.38); c.lineTo(x + s * 0.55, y - s * 0.4); },
    ini: (n) => String(n || "?").trim().slice(0, 1).toUpperCase(),
    cut(c, s, maxW, font) { c.font = font; if (c.measureText(s).width <= maxW) return s; while (s.length > 2 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s + "…"; },
  };
  window.Wrapped.scenelib = L;
})();
