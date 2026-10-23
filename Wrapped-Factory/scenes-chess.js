/* Satranç sahneleri: tahtada kazandığın oyunlar mat olur, kaybettiklerin şahını devirir, açılışın gerçek hamleleriyle oynanır. */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, io, back, rr, txt } = L, nf = K.nf;

  /* ---- tahta ve taşlar (vektör) ---- */
  const BACK = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const INIT = [];
  BACK.forEach((t, c) => { INIT.push({ t, w: false, c, r: 0 }, { t: "P", w: false, c, r: 1 }, { t: "P", w: true, c, r: 6 }, { t, w: true, c, r: 7 }); });
  const geo = (w, h) => { const s = Math.min(w, h) / 8 * 0.98; return { s, ox: (w - 8 * s) / 2, oy: (h - 8 * s) / 2 }; };
  const pos = (g, x, y) => [g.ox + (x + 0.5) * g.s, g.oy + (y + 0.5) * g.s];
  function board(c, g, cs, glow) {
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { c.fillStyle = (r + q) % 2 ? cs.pal.open : cs.pal.review; c.fillRect(g.ox + q * g.s, g.oy + r * g.s, g.s + 0.5, g.s + 0.5); }
    c.strokeStyle = cs.pal.ink; c.lineWidth = Math.max(2, g.s * 0.06); c.strokeRect(g.ox, g.oy, g.s * 8, g.s * 8);
    for (const [q, r, col, a] of glow || []) { c.fillStyle = col; c.globalAlpha = a; c.fillRect(g.ox + q * g.s, g.oy + r * g.s, g.s, g.s); c.globalAlpha = 1; }
  }
  function piece(c, type, white, x, y, s, o = {}) {
    c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = o.al == null ? 1 : o.al;
    if (o.rot) { c.translate(0, 0.38); c.rotate(o.rot); c.translate(0, -0.38); }
    c.fillStyle = white ? "#F6EEDC" : "#2B2118"; c.strokeStyle = white ? "#2B2118" : "#F6EEDC"; c.lineWidth = 0.05; c.lineJoin = "round";
    const fs = () => { c.fill(); c.stroke(); }, base = () => { c.beginPath(); c.rect(-0.27, 0.3, 0.54, 0.09); fs(); };
    const poly = (pts) => { c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath(); fs(); };
    if (type === "P") { c.beginPath(); c.arc(0, -0.2, 0.13, 0, 6.283); fs(); poly([[-0.2, 0.3], [-0.12, 0.0], [-0.06, -0.08], [0.06, -0.08], [0.12, 0.0], [0.2, 0.3]]); }
    else if (type === "R") { poly([[-0.17, 0.3], [-0.12, -0.12], [0.12, -0.12], [0.17, 0.3]]); c.beginPath(); c.rect(-0.2, -0.3, 0.4, 0.18); fs(); [-0.2, -0.05, 0.1].forEach((a) => { c.beginPath(); c.rect(a, -0.4, 0.1, 0.1); fs(); }); }
    else if (type === "N") { poly([[-0.2, 0.3], [-0.18, 0.08], [-0.04, -0.08], [-0.2, -0.06], [-0.22, -0.2], [-0.04, -0.38], [0.12, -0.36], [0.22, -0.14], [0.2, 0.3]]); c.fillStyle = white ? "#2B2118" : "#F6EEDC"; c.beginPath(); c.arc(0.05, -0.22, 0.03, 0, 6.283); c.fill(); }
    else if (type === "B") { c.beginPath(); c.ellipse(0, 0.04, 0.14, 0.26, 0, 0, 6.283); fs(); c.beginPath(); c.arc(0, -0.32, 0.06, 0, 6.283); fs(); c.beginPath(); c.moveTo(-0.06, -0.08); c.lineTo(0.06, -0.22); c.lineWidth = 0.05; c.stroke(); }
    else if (type === "Q") { poly([[-0.2, 0.3], [-0.12, -0.1], [0.12, -0.1], [0.2, 0.3]]); poly([[-0.22, -0.12], [-0.2, -0.32], [-0.1, -0.2], [0, -0.36], [0.1, -0.2], [0.2, -0.32], [0.22, -0.12]]); c.fillStyle = white ? "#2B2118" : "#F6EEDC"; [[-0.2, -0.35], [0, -0.39], [0.2, -0.35]].forEach(([a, b]) => { c.beginPath(); c.arc(a, b, 0.04, 0, 6.283); c.fill(); }); }
    else { poly([[-0.2, 0.3], [-0.14, -0.16], [0.14, -0.16], [0.2, 0.3]]); c.beginPath(); c.rect(-0.12, -0.28, 0.24, 0.12); fs(); c.beginPath(); c.rect(-0.03, -0.48, 0.06, 0.22); fs(); c.beginPath(); c.rect(-0.1, -0.42, 0.2, 0.06); fs(); }
    base(); c.restore();
  }
  const stamp = (c, cs, g, text, p, color) => {
    if (p <= 0) return; const e = back(clamp(p)), x = g.ox + 4 * g.s, y = g.oy + 4 * g.s, fs = L.fit(c, text, g.s * 6.2, g.s * 1.3, cs.disp, 900);
    c.save(); c.translate(x, y); c.rotate(-0.1); c.scale(e, e); c.font = `900 ${fs}px ${cs.disp}`; const tw = c.measureText(text).width + g.s * 0.7;
    c.fillStyle = color; rr(c, -tw / 2, -fs * 0.72, tw, fs * 1.3, g.s * 0.2); c.fill(); c.lineWidth = g.s * 0.08; c.strokeStyle = cs.pal.ink; c.stroke();
    c.fillStyle = "#fff"; c.textAlign = "center"; c.fillText(text, 0, fs * 0.28); c.restore();
  };

  /* ---- mat sahnesi: win=true kazandığın (rakip şahı devrilir), false kaybettiğin (kendi şahın devrilir) ---- */
  function matePattern(win) {
    const T = 5;
    return (c, w, h, t0, cs) => {
      const t = t0 % T, g = geo(w, h), fade = out3(seg(t, 0, 0.7)) * (1 - seg(t, 4.55, 0.4)), s = g.s * 0.92;
      const from = win ? 7 : 0, to = win ? 0 : 7, m = io(seg(t, 0.9, 0.8)), ry = lerp(from, to, m), kingRow = win ? 0 : 7, hit = seg(t, 1.7, 0.4);
      board(c, g, cs, hit > 0 && t < 4.5 ? [[6, kingRow, cs.pal.closed, 0.55 * (0.6 + 0.4 * Math.sin((t - 1.7) * 6))]] : []);
      const draw = (type, white, x, y, o) => { const [px, py] = pos(g, x, y); piece(c, type, white, px, py, s, { al: fade, ...o }); };
      [[5, 1], [6, 1], [7, 1]].forEach(([x, y]) => draw("P", false, x, y)); [[5, 6], [6, 6], [7, 6]].forEach(([x, y]) => draw("P", true, x, y));
      const fall = io(seg(t, 1.9, 0.75)), kingFall = { rot: fall * 1.45, al: fade * (1 - 0.5 * seg(t, 2.4, 0.5)) };
      draw("K", false, 6, 0, win ? kingFall : {}); draw("K", true, 6, 7, win ? {} : kingFall);
      draw("R", win, 0, ry);
      if (hit > 0 && t < 4.5) txt(c, "#", g.ox + 6.5 * g.s, g.oy + (kingRow + 0.18) * g.s, { size: g.s * 0.55, font: cs.disp, w: 900, color: "#fff", align: "center", al: out3(hit) });
      stamp(c, cs, g, win ? "MAT!" : "MAT OLDUN", seg(t, 2.4, 0.5) * (1 - seg(t, 4.4, 0.3)), win ? cs.pal.open : cs.pal.closed);
    };
  }

  /* ---- açılış: gerçek hamleler, parçalar kayarak oynanır ---- */
  const OPEN = [[/sicilian/i, "e2e4 c7c5 g1f3 d7d6"], [/italian/i, "e2e4 e7e5 g1f3 b8c6 f1c4"], [/queen.?s gambit/i, "d2d4 d7d5 c2c4"], [/queen.?s pawn/i, "d2d4 g8f6 c2c4 e7e6"], [/french/i, "e2e4 e7e6 d2d4 d7d5"],
    [/caro/i, "e2e4 c7c6 d2d4 d7d5"], [/ruy|spanish/i, "e2e4 e7e5 g1f3 b8c6 f1b5"], [/scandinavian/i, "e2e4 d7d5 e4d5 d8d5"], [/london/i, "d2d4 d7d5 c1f4 g8f6"], [/king.?s indian/i, "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7"],
    [/dutch/i, "d2d4 f7f5 g2g3 g8f6"], [/english/i, "c2c4 e7e5 b1c3 g8f6"], [/pirc/i, "e2e4 d7d6 d2d4 g8f6 b1c3"], [/vienna/i, "e2e4 e7e5 b1c3 g8f6"], [/slav/i, "d2d4 d7d5 c2c4 c7c6"], [/nimzo/i, "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4"],
    [/scotch/i, "e2e4 e7e5 g1f3 b8c6 d2d4 e5d4"], [/alekhine/i, "e2e4 g8f6 e4e5 f6d5"], [/catalan/i, "d2d4 g8f6 c2c4 e7e6 g2g3"], [/petrov|russian/i, "e2e4 e7e5 g1f3 g8f6"], [/king.?s pawn/i, "e2e4 e7e5 g1f3 b8c6"]];
  const movesFor = (name) => ((OPEN.find(([re]) => re.test(name || "")) || [0, "e2e4 e7e5 g1f3 b8c6"])[1]).split(" ");
  const toRC = (sq) => [sq.charCodeAt(0) - 97, 8 - +sq[1]];
  function openingScene(name) {
    const moves = movesFor(name), STEP = 1.1, T0 = 0.9, TOTAL = T0 + moves.length * STEP + 1.6;
    return (c, w, h, t0, cs) => {
      const t = t0 % TOTAL, g = geo(w, h), s = g.s * 0.92, P = INIT.map((p) => ({ ...p, x: p.c, y: p.r, al: 1 })), fade = out3(seg(t, 0, 0.6)) * (1 - seg(t, TOTAL - 0.5, 0.45)), glow = [];
      moves.forEach((m, i) => {
        const st = T0 + i * STEP; if (t < st) return; const [fc, fr] = toRC(m.slice(0, 2)), [tc, tr] = toRC(m.slice(2, 4)), pr = clamp((t - st) / 0.75), e = io(pr);
        const pc = P.find((p) => p.al > 0 && p.c === fc && p.r === fr); if (!pc) return; const cap = P.find((p) => p !== pc && p.al > 0 && p.c === tc && p.r === tr);
        if (t < st + 1.6) glow.push([fc, fr, cs.pal.link, 0.4 * (1 - seg(t, st + 0.8, 0.8))], [tc, tr, cs.pal.link, 0.5 * (1 - seg(t, st + 0.8, 0.8))]);
        if (pr >= 1) { pc.c = pc.x = tc; pc.r = pc.y = tr; if (cap) cap.al = 0; } else { pc.x = lerp(fc, tc, e); pc.y = lerp(fr, tr, e) - (pc.t === "N" ? Math.sin(Math.PI * e) * 0.6 : 0); if (cap && pr > 0.75) cap.al = 1 - (pr - 0.75) / 0.25; pc.lift = true; }
      });
      board(c, g, cs, glow);
      P.filter((p) => p.al > 0).sort((a, b) => a.y - b.y + (a.lift ? 5 : 0) - (b.lift ? 5 : 0)).forEach((p) => { const [px, py] = pos(g, p.x, p.y); piece(c, p.t, p.w, px, py, s, { al: p.al * fade }); });
    };
  }

  /* ---- galibiyet serisi: at hamle hamle ilerler, her iniş bir galibiyet ---- */
  function streakScene(n) {
    const hops = clamp(n, 1, 14), R = L.rand(41 * hops + 7), path = [[1, 7]], mv = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
    for (let i = 0; i < hops; i++) { const [x, y] = path[i], ok = mv.map(([a, b]) => [x + a, y + b]).filter(([a, b]) => a >= 0 && a < 8 && b >= 0 && b < 8 && !path.some(([p, q]) => p === a && q === b)); path.push((ok.length ? ok : [[x, y]])[Math.floor(R() * Math.max(ok.length, 1))]); }
    const STEP = 0.5, T = 0.8 + hops * STEP + 2;
    return (c, w, h, t0, cs) => {
      const t = t0 % T, g = geo(w, h), s = g.s * 0.92, step = clamp((t - 0.8) / STEP, 0, hops), k = Math.min(hops - 1, Math.floor(step)), pr = hops - 0 <= step ? 1 : step - k, e = io(pr);
      board(c, g, cs, []); c.strokeStyle = cs.pal.closed; c.lineWidth = g.s * 0.09; c.lineCap = "round"; c.beginPath();
      for (let i = 0; i <= Math.min(hops, Math.floor(step)); i++) { const [px, py] = pos(g, ...path[i]); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
      for (let i = 1; i <= Math.min(hops, Math.floor(step)); i++) { const [px, py] = pos(g, ...path[i]); c.fillStyle = cs.pal.closed; c.beginPath(); c.arc(px, py, g.s * 0.2, 0, 6.283); c.fill(); txt(c, String(i), px, py + g.s * 0.08, { size: g.s * 0.26, font: cs.sans, w: 900, color: "#fff", align: "center" }); }
      const a = path[k], b = path[Math.min(k + 1, hops)], done = step >= hops, x = done ? b[0] : lerp(a[0], b[0], e), y = (done ? b[1] : lerp(a[1], b[1], e)) - (done ? 0 : Math.sin(Math.PI * e) * 0.55), [px, py] = pos(g, x, y);
      piece(c, "N", true, px, py, s * (done ? 1.08 : 1)); if (done) txt(c, `${hops}`, px, py - g.s * 0.7, { size: g.s * 0.5, font: cs.disp, w: 900, color: cs.pal.review, align: "center", al: out3(seg(t - (0.8 + hops * STEP), 0, 0.4)) });
    };
  }

  const sc = {
    mate: (W) => ({ id: "chess.mate", t: "t-closed", lead: "Mat verdiğin oyunlar", big: { v: W.res.wins, f: nf.format }, sub: "Kazandığın her oyun, rakibin şahına son bir vuruş demek.", dur: 5, still: 3.2, slot: "closed", draw: matePattern(true) }),
    fall: (W) => ({ id: "chess.fall", t: "t-ink", lead: "Şahın devrildiği oyunlar", big: { v: W.res.losses, f: nf.format }, sub: "Kaybetmek de oyunun parçası: tahta her seferinde yeniden kurulur.", dur: 5, still: 3.2, slot: "ink", draw: matePattern(false) }),
    opening: (W) => ({ id: "chess.opening", t: "t-open", lead: "En sevdiğin açılış tahtada", big: { text: W.openings[0].name }, bigSize: 17, sub: `${nf.format(W.openings[0].games)} oyun, skorun %${W.openings[0].score}.`, dur: 8, still: 6, slot: "open", draw: openingScene(W.openings[0].name) }),
    streak: (W) => ({ id: "chess.streak", t: "t-open", lead: "En uzun galibiyet serin", big: { v: W.winStreak, f: nf.format }, sub: W.loseStreak >= 4 ? `En kötü anın ise ${W.loseStreak} oyunluk bir yenilgi serisiydi.` : "Yenilgi serin çok kısa kaldı, harika.", dur: 8, still: 7, slot: "link", draw: streakScene(W.winStreak) }),
    reel: (W) => [sc.mate(W), sc.fall(W)],
  };
  Wrapped.scenes.chess = sc;
})();
