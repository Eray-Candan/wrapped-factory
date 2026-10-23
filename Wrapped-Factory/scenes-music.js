/* Müzik sahneleri: dönen plak (en çok dinlediğin sanatçı) ve atlama bandı (gerçek atlama oranı). */
(() => {
  "use strict";
  const K = Wrapped.kit, L = Wrapped.scenelib, { clamp, lerp, seg, out3, io, rr, txt, rand } = L, nf = K.nf;

  function vinyl(W) {
    const artist = (W.artists[0] && W.artists[0].name) || "?", notes = Array.from({ length: 5 }, (_, i) => ({ x: 0.74 + (i % 3) * 0.07, ph: i / 5, v: 0.1 + (i % 2) * 0.05 }));
    return (c, w, h, t, cs) => {
      const R = Math.min(w * 0.44, h * 0.46), cx = w * 0.44, cy = h * 0.52, ang = t * 0.9, u = w / 100;
      c.fillStyle = cs.pal.merge; rr(c, cx - R * 0.78, cy - R * 1.04, R * 2, R * 2.08, R * 0.08); c.fill(); c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(cx - R * 0.78, cy - R * 1.04, R * 0.06, R * 2.08);
      c.save(); c.translate(cx, cy); c.rotate(ang); c.fillStyle = "#131313"; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill();
      c.strokeStyle = "rgba(255,255,255,.1)"; c.lineWidth = 1.2; for (let r = R * 0.36; r < R * 0.97; r += R * 0.055) { c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke(); }
      if (c.createConicGradient) { const g = c.createConicGradient(0, 0, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.08, "rgba(255,255,255,.12)"); g.addColorStop(0.16, "rgba(255,255,255,0)"); g.addColorStop(0.58, "rgba(255,255,255,0)"); g.addColorStop(0.66, "rgba(255,255,255,.1)"); g.addColorStop(0.74, "rgba(255,255,255,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 0.98, 0, 6.283); c.fill(); }
      c.fillStyle = cs.pal.review; c.beginPath(); c.arc(0, 0, R * 0.33, 0, 6.283); c.fill(); txt(c, L.ini(artist), 0, R * 0.12, { size: R * 0.36, font: cs.disp, w: 900, color: cs.f.review, align: "center" }); c.fillStyle = "#131313"; c.beginPath(); c.arc(0, 0, R * 0.05, 0, 6.283); c.fill(); c.restore();
      const arm = lerp(-0.1, 0.5, io(seg(t, 0.3, 1.3))), px = w * 0.93, py = h * 0.09; c.save(); c.translate(px, py); c.rotate(arm); c.strokeStyle = cs.fg; c.lineWidth = u * 1.1; c.lineCap = "round"; c.beginPath(); c.moveTo(0, 0); c.lineTo(-R * 0.22, R * 1.05); c.stroke(); c.fillStyle = cs.fg; rr(c, -R * 0.22 - u * 1.8, R * 1.05 - u * 1.2, u * 3.6, u * 4.4, u * 0.8); c.fill(); c.beginPath(); c.arc(0, 0, u * 2.6, 0, 6.283); c.fill(); c.restore();
      for (const n of notes) { const p = (t * n.v + n.ph) % 1, x = n.x * w + Math.sin(p * 9) * u * 2, y = h * (0.82 - p * 0.7); c.globalAlpha = Math.sin(p * Math.PI) * 0.75 * seg(t, 1.2, 0.5); c.fillStyle = cs.fg; c.beginPath(); c.ellipse(x, y, u * 1.7, u * 1.2, -0.4, 0, 6.283); c.fill(); c.fillRect(x + u * 1.2, y - u * 6, u * 0.5, u * 6); c.beginPath(); c.moveTo(x + u * 1.7, y - u * 6); c.quadraticCurveTo(x + u * 4.4, y - u * 4.4, x + u * 2.6, y - u * 2.2); c.lineTo(x + u * 1.7, y - u * 3.4); c.fill(); c.globalAlpha = 1; }
      txt(c, L.cut(c, artist, w * 0.9, `800 ${u * 4.6}px ${cs.sans}`), w * 0.5, h * 0.985, { size: u * 4.6, font: cs.sans, w: 800, color: cs.fg, align: "center", al: seg(t, 1.2, 0.5) });
    };
  }

  function skipBelt(W) {
    const tr = (W.tracks && W.tracks.length ? W.tracks : [{ track: "?", artist: "" }]), rate = clamp(W.skipRate, 0.02, 0.98), R = rand(77);
    const skips = Array.from({ length: 200 }, () => R() < rate);
    return (c, w, h, t, cs) => {
      const u = w / 100, cw = u * 38, ch = u * 17, sp = cw * 1.1, speed = u * 44, cy = h * 0.46, trig = w * 0.5, head = 0.3;
      c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(0, cy - ch * 0.7, w, ch * 1.4); c.fillStyle = cs.fg; c.globalAlpha = 0.35; c.fillRect(trig, cy - ch * 0.9, u * 0.6, ch * 1.8); c.globalAlpha = 1;
      let kept = 0, skipped = 0; const first = Math.max(0, Math.floor((t * speed - w - cw) / sp)), last = Math.floor((t * speed + head * w) / sp);
      for (let j = 0; j <= last; j++) { const x = -cw + (t * speed - j * sp); if (x > trig + cw * 0.2) { skips[j % 200] ? skipped++ : kept++; } }
      for (let j = first; j <= last; j++) {
        const x = -cw + (t * speed - j * sp), sk = skips[j % 200], p = clamp((x - trig) / (w * 0.22)); if (x > w + cw || x < -cw) continue;
        c.save(); let dy = 0, rot = 0, al = 1; if (sk && p > 0) { dy = -p * h * 0.5; rot = p * 0.7; al = 1 - p; } c.globalAlpha = al; c.translate(x + cw / 2, cy + dy); c.rotate(rot); c.translate(-cw / 2, 0);
        c.fillStyle = sk && p > 0 ? cs.pal.closed : cs.pal.paper; rr(c, 0, -ch / 2, cw, ch, u * 2.2); c.fill(); c.fillStyle = cs.pal.ink;
        c.fillStyle = cs.pal.ink; c.beginPath(); c.arc(u * 5.2, 0, u * 3.4, 0, 6.283); c.fill(); c.fillStyle = cs.pal.paper; c.beginPath(); c.moveTo(u * 4.2, -u * 1.7); c.lineTo(u * 6.8, 0); c.lineTo(u * 4.2, u * 1.7); c.fill();
        txt(c, L.cut(c, tr[j % tr.length].track, cw - u * 13, `800 ${u * 3.6}px ${cs.sans}`), u * 10.6, -u * 0.6, { size: u * 3.6, font: cs.sans, w: 800, color: cs.pal.ink }); txt(c, L.cut(c, tr[j % tr.length].artist, cw - u * 13, `600 ${u * 3}px ${cs.sans}`), u * 10.6, u * 3.4, { size: u * 3, font: cs.sans, w: 600, color: cs.pal.ink, al: 0.65 });
        if (!sk) { c.fillStyle = cs.pal.ink; c.globalAlpha = al * 0.18; rr(c, u * 3, ch / 2 - u * 2.6, cw - u * 6, u * 1, u * 0.5); c.fill(); c.globalAlpha = al; c.fillStyle = cs.pal.merge; rr(c, u * 3, ch / 2 - u * 2.6, (cw - u * 6) * clamp(x / trig), u * 1, u * 0.5); c.fill(); }
        c.restore();
      }
      const bx = w * 0.06, by = h * 0.8;
      [[kept, "dinlenen", cs.pal.open, cs.f.open], [skipped, "atlanan", cs.pal.closed, cs.f.closed]].forEach(([n, lab, col, fg], i) => { const x = bx + i * w * 0.46; c.fillStyle = col; rr(c, x, by, w * 0.42, u * 17, u * 3); c.fill(); txt(c, nf.format(n), x + u * 4, by + u * 11.2, { size: u * 9, font: cs.disp, w: 900, color: fg }); txt(c, lab, x + w * 0.42 - u * 4, by + u * 11, { size: u * 4.2, font: cs.sans, w: 800, color: fg, align: "right" }); });
    };
  }

  const sc = {
    vinyl: (W) => ({ id: "music.vinyl", t: "t-closed", lead: "En çok dinlediğin sanatçı", big: { text: W.artists[0].name }, bigSize: 16, sub: `${Math.floor(W.artists[0].min / 60)} sa ${Math.round(W.artists[0].min % 60)} dk, toplam sürenin %${Math.round(W.topArtistShare * 100)} kadarı.`, dur: 6, still: 3, slot: "closed", draw: vinyl(W) }),
    skipbelt: (W) => ({ id: "music.skipbelt", t: "t-review", lead: "Atlama oranın", big: { v: Math.round(W.skipRate * 100), f: (v) => `%${v}` }, sub: "Şarkılar bandda akıyor: sonuna kadar dinlediklerin kalıyor, atladıkların fırlıyor.", dur: 9, still: 7, slot: "review", draw: skipBelt(W) }),
    reel: (W) => [sc.vinyl(W)],
  };
  Wrapped.scenes.music = sc;
})();
