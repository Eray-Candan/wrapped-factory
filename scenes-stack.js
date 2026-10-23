/* Kod Soruları sahneleri: terminalde yazılan istatistik ve kabul edilen cevap damgaları. */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, back, rr, txt } = L, nf = K.nf;

  function terminal(W) {
    const lines = [["$ so stats --year " + W.year, 1], [`itibar    +${nf.format(W.gained)}${W.lost ? `  (net ${W.net >= 0 ? "+" : "-"}${nf.format(Math.abs(W.net))})` : ""}`, 0], [`cevap     ${nf.format(W.nA)}  kabul ${nf.format(W.accepted)} (%${Math.round(W.acceptRate * 100)})`, 0], [`soru      ${nf.format(W.nQ)}`, 0],
      [`etiket    ${W.tags.slice(0, 3).map((t) => t.name).join(", ")}`, 0], W.best ? [`en iyi    ${W.best.score} oy`, 0] : null, ["$ ", 1]].filter(Boolean);
    const SPEED = 34, GAP = 0.22; let at = 0.4; const starts = lines.map(([s]) => { const t = at; at += s.length / SPEED + GAP; return t; });
    return (c, w, h, t, cs) => {
      const u = w / 100, longest = lines.reduce((m, [s]) => Math.max(m, s.length), 1), fs = Math.min(u * 6.4, (w * 0.84) / (longest * 0.6)), lh = fs * 1.7, px = u * 5, py = u * 5;
      c.fillStyle = cs.pal.ink; c.globalAlpha = 0.94; rr(c, 0, 0, w, Math.min(h, lines.length * lh + py * 2), u * 2.4); c.fill(); c.globalAlpha = 1; c.font = `700 ${fs}px ${cs.disp}`; c.textBaseline = "alphabetic";
      let lastY = 0, lastX = 0;
      lines.forEach(([s, cmd], i) => {
        const n = clamp(Math.floor((t - starts[i]) * SPEED), 0, s.length); if (n <= 0 && i > 0) return; const shown = s.slice(0, n), y = py + lh * (i + 0.8);
        if (cmd) { c.fillStyle = cs.pal.open; c.fillText(shown, px, y); } else { const k = Math.min(10, shown.length); c.fillStyle = cs.f.ink; c.globalAlpha = 0.55; c.fillText(shown.slice(0, k), px, y); c.globalAlpha = 1; c.fillStyle = cs.f.ink; c.fillText(shown.slice(k), px + c.measureText(shown.slice(0, k)).width, y); }
        lastY = y; lastX = px + c.measureText(shown).width;
      });
      if (Math.floor(t * 2) % 2 === 0 || t < 0.4) { c.fillStyle = cs.pal.open; c.fillRect(lastX + 2, lastY - fs * 0.85, fs * 0.55, fs * 1.0); }
    };
  }

  function accepted(W) {
    const n = Math.max(1, Math.min(W.accepted, 48));
    return (c, w, h, t, cs) => {
      const cols = Math.ceil(Math.sqrt((n * w) / h)), rows = Math.ceil(n / cols), g = w * 0.018, cw = (w - g * (cols - 1)) / cols, chh = Math.min(cw, (h * 0.82 - g * (rows - 1)) / rows), x0 = 0, y0 = (h * 0.82 - (chh * rows + g * (rows - 1))) / 2;
      for (let i = 0; i < n; i++) {
        const p = back(seg(t, 0.2 + i * 0.07, 0.3)); if (p <= 0) continue; const x = x0 + (i % cols) * (cw + g), y = y0 + Math.floor(i / cols) * (chh + g), cx = x + cw / 2, cy = y + chh / 2;
        c.save(); c.translate(cx, cy); c.scale(p, p); c.fillStyle = cs.pal.closed; rr(c, -cw / 2, -chh / 2, cw, chh, Math.min(cw, chh) * 0.22); c.fill(); c.strokeStyle = cs.f.closed; c.lineWidth = Math.min(cw, chh) * 0.13; c.lineCap = "round"; c.lineJoin = "round"; L.check(c, 0, 0, Math.min(cw, chh) * 0.55); c.stroke(); c.restore();
      }
      const more = W.accepted - n; txt(c, more > 0 ? `+${nf.format(more)} daha, toplam ${nf.format(W.accepted)} kabul` : `${nf.format(W.accepted)} cevap kabul edildi`, w / 2, h * 0.96, { size: w * 0.05, font: cs.sans, w: 800, color: cs.fg, align: "center", al: seg(t, 0.4 + n * 0.07, 0.4) });
    };
  }

  const sc = {
    terminal: (W) => ({ id: "stack.terminal", t: "t-ink", lead: "Terminalde yılın özeti", sub: "Komut yazıldı, çıktı geldi.", dur: 6, still: 6, slot: "ink", draw: terminal(W), slide: 8 }),
    accepted: (W) => ({ id: "stack.accepted", t: "t-closed", lead: "Kabul edilen cevaplar", big: { v: W.accepted, f: nf.format }, sub: `Her yeşil damga, birinin sorununu çözdüğün bir cevap (%${Math.round(W.acceptRate * 100)}).`, dur: 5, still: 5, slot: "closed", draw: accepted(W) }),
    reel: (W) => [sc.terminal(W)],
  };
  Wrapped.scenes.stack = sc;
})();
