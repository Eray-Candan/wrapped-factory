/* Lofi müzik: tamamen Web Audio ile kodla üretilir (örnek dosya yok, telif yok). Her kaynağın kendi ruh hali (tempo, tonalite, akorlar) vardır.
 * Canlı çalma kullanıcı düğmesiyle başlar (otomatik ses yok, WCAG 1.4.2); aynı üretici videoya çevrimdışı render edilir. */
(() => {
  "use strict";
  const W = window.Wrapped, HOOKS = W.hooks, K = W.kit;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MAJ7 = [0, 4, 7, 11], MIN7 = [0, 3, 7, 10], DOM7 = [0, 4, 7, 10], PM = [0, 2, 4, 7, 9], Pm = [0, 3, 5, 7, 10];
  /* ruh halleri: bpm, kök nota (MIDI), akor dizisi [kökten uzaklık, aralıklar], gam, salınım, akor filtresi, yankı */
  const MOODS = {
    github: { bpm: 76, root: 48, sw: 0.12, lp: 1900, verb: 0.2, sc: PM, prog: [[0, MAJ7], [9, MIN7], [2, MIN7], [7, DOM7]] },
    chess:  { bpm: 66, root: 50, sw: 0.1,  lp: 1500, verb: 0.26, sc: Pm, prog: [[0, MIN7], [5, DOM7], [10, MAJ7], [3, MAJ7]] },
    chat:   { bpm: 84, root: 53, sw: 0.14, lp: 2100, verb: 0.18, sc: PM, prog: [[0, MAJ7], [9, MIN7], [2, MIN7], [7, DOM7]] },
    anime:  { bpm: 92, root: 55, sw: 0.12, lp: 2600, verb: 0.2, sc: PM, lead: 12, prog: [[0, MAJ7], [9, MIN7], [5, MAJ7], [7, DOM7]] },
    music:  { bpm: 88, root: 57, sw: 0.16, lp: 2000, verb: 0.2, sc: Pm, prog: [[0, MIN7], [5, MIN7], [10, DOM7], [3, MAJ7]] },
    film:   { bpm: 62, root: 51, sw: 0.1,  lp: 1250, verb: 0.34, sc: PM, prog: [[0, MAJ7], [9, MIN7], [2, MIN7], [7, DOM7]] },
    code:   { bpm: 80, root: 52, sw: 0.12, lp: 1700, verb: 0.2, sc: Pm, prog: [[0, MIN7], [5, DOM7], [10, MAJ7], [3, MAJ7]] },
    team:   { bpm: 84, root: 58, sw: 0.14, lp: 2200, verb: 0.18, sc: PM, prog: [[0, MAJ7], [9, MIN7], [2, MIN7], [7, DOM7]] },
  };
  const hashStr = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

  function impulse(ctx, secs) {
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate), r = K.rng(99);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * (1 - i / n) ** 3; }
    return b;
  }
  function noiseBuf(ctx, secs) { const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = K.rng(5); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; return b; }
  function crackleBuf(ctx) {                                    // plak çıtırtısı: hafif hışırtı + seyrek tıklar
    const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = K.rng(17);
    for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * 0.0035;
    for (let k = 0; k < 26; k++) { const at = Math.floor(r() * (n - 400)), a = 0.05 + r() * 0.16; for (let j = 0; j < 90; j++) d[at + j] += (r() * 2 - 1) * a * (1 - j / 90); }
    return b;
  }
  /* sinyal zinciri: bus -> (yankı) -> alçak geçiren -> kompresör -> ana ses */
  function chain(ctx, vol, mood) {
    const bus = ctx.createGain(), lp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), master = ctx.createGain(), verb = ctx.createConvolver(), vg = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.value = 7800; comp.threshold.value = -20; comp.ratio.value = 3; master.gain.value = vol; verb.buffer = impulse(ctx, 1.7); vg.gain.value = mood ? mood.verb : 0.2;
    bus.connect(lp); bus.connect(verb); verb.connect(vg); vg.connect(lp); lp.connect(comp); comp.connect(master); master.connect(ctx.destination);
    const crk = ctx.createBufferSource(), cf = ctx.createBiquadFilter(), cg = ctx.createGain(); crk.buffer = crackleBuf(ctx); crk.loop = true; cf.type = "bandpass"; cf.frequency.value = 2600; cg.gain.value = 1.4; crk.connect(cf); cf.connect(cg); cg.connect(master); crk.start();
    return { bus, master, noise: noiseBuf(ctx, 1.2), crk };
  }

  function bar(ctx, ch, t, idx, mood, seed) {
    const R = K.rng(seed), beat = 60 / mood.bpm, off = mood.sw * beat * 0.5, [rootOff, iv] = mood.prog[idx % 4], base = mood.root + rootOff + 12;
    const env = (g, t0, a, peak, d, rel) => { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.3, 0.0002), t0 + a + d); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + rel); };
    const osc = (type, f, t0, dur, peak, a, d, rel, dest, det = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det; env(g, t0, a, peak, d, rel); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + a + d + rel + 0.05); };
    const nz = (t0, dur, type, freq, q, peak, dest) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = ch.noise; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0, R() * 0.8, dur + 0.02); };
    // akorlar (yumuşak, Rhodes benzeri: sinüs + üçgen, hafif detune), bir çubuk için ortak filtre
    const cl = ctx.createBiquadFilter(); cl.type = "lowpass"; cl.frequency.value = mood.lp; cl.connect(ch.bus);
    const notes = iv.map((i) => { let m = base + i; if (m > 70) m -= 12; return m; });
    [[0, 1.9, 0.07], [1.5, 0.55, 0.045]].forEach(([b, d, v], k) => { if (k === 1 && R() < 0.35) return; const t0 = t + b * beat + (k ? off : 0); notes.forEach((m, j) => { osc("sine", hz(m), t0 + j * 0.018, d, v, 0.012, 0.5 * beat, d * beat * 0.9, cl, (R() - 0.5) * 8); osc("triangle", hz(m + 12), t0 + j * 0.018, d, v * 0.22, 0.01, 0.3 * beat, d * beat * 0.6, cl, (R() - 0.5) * 10); }); });
    // bas
    [[0, 1.1, 0.2], [2.5, 0.8, 0.15]].forEach(([b, d, v], k) => { if (k === 1 && R() < 0.4) return; osc("sine", hz(mood.root + rootOff - 12 + 12), t + b * beat + (k ? off : 0), d, v, 0.01, 0.15 * beat, d * beat * 0.6, ch.bus); });
    // davul
    [0, 2, ...(R() < 0.4 ? [1.5] : [])].forEach((b) => { const t0 = t + b * beat + (b % 1 ? off : 0), o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.2); g.gain.setValueAtTime(0.48, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24); o.connect(g); g.connect(ch.bus); o.start(t0); o.stop(t0 + 0.28); });
    [1, 3].forEach((b) => { const t0 = t + b * beat; nz(t0, 0.14, "bandpass", 1750, 0.8, 0.22, ch.bus); osc("triangle", 185, t0, 0.1, 0.1, 0.002, 0.04, 0.06, ch.bus); });
    for (let k = 0; k < 8; k++) { const t0 = t + (k * beat) / 2 + (k % 2 ? off : 0); nz(t0, 0.05, "highpass", 7200, 0.7, (k % 2 ? 0.07 : 0.11) * (0.8 + R() * 0.4), ch.bus); if (R() < 0.22) nz(t0 + beat / 4, 0.03, "highpass", 8000, 0.7, 0.05, ch.bus); }
    // seyrek melodi
    let last = (R() * mood.sc.length) | 0; for (let k = 0; k < 8; k++) { if (R() > 0.24) continue; last = clamp3(last + ((R() * 3) | 0) - 1, 0, mood.sc.length - 1); const m = mood.root + 24 + (mood.lead || 0) + mood.sc[last], t0 = t + (k * beat) / 2 + (k % 2 ? off : 0), d = (0.5 + R() * 0.6) * beat; osc("triangle", hz(m), t0, d, 0.05, 0.01, d * 0.5, d * 0.7, cl, (R() - 0.5) * 12); }
  }
  const clamp3 = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---- canlı çalma ---- */
  const Lofi = { on: false, vol: 0.5 };
  let ctx = null, ch = null, timer = 0, nextT = 0, idx = 0, moodId = "github", mood = MOODS.github;
  const gainOf = (v) => v * 1.9;
  function tick() { if (!ctx) return; while (nextT < ctx.currentTime + 6) { bar(ctx, ch, nextT, idx, mood, hashStr(moodId) + idx * 977); idx++; nextT += (4 * 60) / mood.bpm; } }
  Lofi.start = () => {
    if (Lofi.on) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); ch = chain(ctx, 0, mood); ctx.resume && ctx.resume(); nextT = ctx.currentTime + 0.15; idx = 0; tick(); timer = setInterval(tick, 700);
    ch.master.gain.setTargetAtTime(gainOf(Lofi.vol), ctx.currentTime, 0.5); Lofi.on = true; ui(); persist();
  };
  Lofi.stop = () => {
    if (!Lofi.on) return; Lofi.on = false; const c = ctx; clearInterval(timer); try { ch.master.gain.setTargetAtTime(0, c.currentTime, 0.12); } catch { /* kapalı */ } setTimeout(() => { try { c.close(); } catch { /* zaten kapalı */ } }, 700); ctx = ch = null; ui(); persist();
  };
  Lofi.toggle = () => (Lofi.on ? Lofi.stop() : Lofi.start());
  Lofi.setVolume = (v) => { Lofi.vol = clamp3(+v || 0, 0, 1); try { localStorage.setItem("wf-lofi-vol", String(Lofi.vol)); } catch { /* özel pencere */ } if (ctx) ch.master.gain.setTargetAtTime(gainOf(Lofi.vol), ctx.currentTime, 0.1); };
  Lofi.mood = (id) => { moodId = MOODS[id] ? id : "github"; mood = MOODS[moodId]; };

  /* ---- video için çevrimdışı render ---- */
  async function render(seconds, id) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 44100, oc = new OAC(2, Math.ceil(sr * seconds), sr), m = MOODS[id] || MOODS.github, c = chain(oc, gainOf(Lofi.vol) * 1.05, m);
    let t = 0.05, i = 0; while (t < seconds - 0.05) { bar(oc, c, t, i, m, hashStr(id || "github") + i * 977); i++; t += (4 * 60) / m.bpm; }
    c.master.gain.setValueAtTime(gainOf(Lofi.vol) * 1.05, Math.max(0, seconds - 1.4)); c.master.gain.linearRampToValueAtTime(0, seconds - 0.05);
    return oc.startRendering();
  }
  HOOKS.audioTrack = async (seconds) => {
    const buf = await render(seconds + 0.6, moodId), AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), dest = ac.createMediaStreamDestination(), src = ac.createBufferSource();
    src.buffer = buf; src.connect(dest);
    return { track: dest.stream.getAudioTracks()[0], start() { ac.resume && ac.resume(); src.start(); }, stop() { try { src.stop(); } catch { /* bitti */ } setTimeout(() => { try { ac.close(); } catch { /* kapalı */ } }, 400); } };
  };
  HOOKS.themeChanged = (skin) => Lofi.mood(skin);

  /* ---- arayüz: her ekranda görünen düğme + ses düzeyi ---- */
  let box = null;
  function persist() { try { localStorage.setItem("wf-lofi", Lofi.on ? "1" : "0"); } catch { /* özel pencere */ } }
  function ui() {
    if (!box) {
      box = document.createElement("div"); box.className = "lofi"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Arka plan müziği");
      box.innerHTML = '<button type="button" aria-pressed="false"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="lbl">Lofi</span></button><input type="range" min="0" max="1" step="0.05" aria-label="Lofi ses düzeyi">';
      box.querySelector("button").onclick = Lofi.toggle; const r = box.querySelector("input"); r.value = Lofi.vol; r.oninput = () => Lofi.setVolume(r.value); document.body.append(box);
    }
    box.dataset.on = Lofi.on ? "1" : "0"; const b = box.querySelector("button"); b.setAttribute("aria-pressed", String(Lofi.on)); b.setAttribute("aria-label", Lofi.on ? "Lofi müziği kapat" : "Lofi müziği aç"); b.title = Lofi.on ? "Lofi müziği kapat" : "Lofi müziği aç";
  }
  try { const v = parseFloat(localStorage.getItem("wf-lofi-vol")); if (v >= 0 && v <= 1) Lofi.vol = v; } catch { /* özel pencere */ }
  const boot = () => {
    ui(); let armed = false; try { armed = localStorage.getItem("wf-lofi") === "1"; } catch { /* özel pencere */ }
    if (armed) { const go = (e) => { if (e.target && e.target.closest && e.target.closest(".lofi")) return; removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true); Lofi.start(); }; addEventListener("pointerdown", go, true); addEventListener("keydown", go, true); }
    document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend && ctx.suspend(); else ctx.resume && ctx.resume(); });
  };
  if (document.body) boot(); else addEventListener("DOMContentLoaded", boot);
  W.audio = { Lofi, MOODS, render };
})();
