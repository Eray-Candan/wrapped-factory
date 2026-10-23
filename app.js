/* Wrapped Fabrikası: ana ekran, kaynak seçici, form üretimi ve yönlendirme */
(() => {
  "use strict";
  const W = Wrapped, K = W.kit, { el, $, THIS_YEAR } = K;
  const tiles = $("tiles"), panel = $("panel");
  let cur = null;

  const hasDemo = (p) => !!(W.demos && W.demos[p.id]);
  function buildTiles() {
    tiles.textContent = "";
    W.list().forEach((p) => {
      const b = el("button", "tile"); b.type = "button"; b.dataset.id = p.id; b.setAttribute("aria-pressed", "false");
      const th = p.theme || {}, cl = th.colors || {}, fgc = th.fg || {}; b.style.background = cl.merge || p.color; b.style.setProperty("--fg", fgc.merge || p.fg || "#fff"); if (th.skin) b.dataset.skin = th.skin;
      const ic = el("div"); ic.innerHTML = p.icon || ""; b.append(ic, el("h3", "", p.name), el("p", "", p.blurb));
      b.onclick = () => select(p.id); tiles.append(b);
    });
  }
  const yearOptions = (sel, years) => {
    sel.textContent = ""; (years || Array.from({ length: 6 }, (_, i) => THIS_YEAR - i)).forEach((y) => { const yy = y.y || y, o = el("option", "", y.label || (yy === THIS_YEAR ? `${yy} (şimdiye kadar)` : String(yy))); o.value = yy; sel.append(o); });
  };

  /* ---- kullanıcı adı tabanlı kaynaklar ---- */
  function userForm(p) {
    const I = p.input, f = el("form", "form"); f.autocomplete = "off";
    let plat = null;
    if (I.platforms) { plat = el("select", "plat"); plat.setAttribute("aria-label", "Platform"); I.platforms.forEach((x) => { const o = el("option", "", x.name); o.value = x.id; plat.append(o); }); plat.style.gridColumn = "1 / -1"; f.append(plat); }
    const fld = el("label", "field"); fld.append(el("span", "at", I.at || "@"));
    const inp = el("input"); inp.type = "text"; inp.id = "userIn"; inp.placeholder = I.placeholder; inp.setAttribute("aria-label", I.label); inp.required = true; inp.maxLength = 39; inp.autocapitalize = "off"; inp.spellcheck = false; fld.append(inp); f.append(fld);
    let rv = null, rin = null;
    if (I.duel) { rv = el("label", "field rival"); rv.hidden = true; rv.append(el("span", "at", "vs")); rin = el("input"); rin.type = "text"; rin.id = "rivalIn"; rin.placeholder = I.rivalPlaceholder || "rakibinin kullanıcı adı"; rin.maxLength = 39; rin.autocapitalize = "off"; rin.spellcheck = false; rv.append(rin); f.append(rv); }
    const ysel = el("select"); ysel.id = "yearSel"; ysel.setAttribute("aria-label", "Yıl"); yearOptions(ysel); f.append(ysel);
    const go = el("button", "go", "Yılımı göster"); go.type = "submit"; go.id = "goBtn"; f.append(go);
    const below = el("div", "below"), row = el("div", "textrow"); below.append(row);
    const tb = (t, fn) => { const b = el("button", "textbtn", t); b.type = "button"; b.onclick = fn; row.append(b); return b; };
    if (I.duel) { const d = tb("Arkadaşınla düello yap", () => { rv.hidden = !rv.hidden; d.textContent = rv.hidden ? "Arkadaşınla düello yap" : "Düelloyu kapat"; if (!rv.hidden) rin.focus(); }); }
    if (hasDemo(p)) tb("Önce örnek bir yıla bak", () => W.run({ src: p.id, demo: true, year: +ysel.value, input: { user: "ornek", label: "@ornek", query: {} }, options: {} }));
    if (I.duel && hasDemo(p)) tb("Örnek düelloya bak", () => W.run({ src: p.id, demo: true, year: +ysel.value, input: { user: "ornek", label: "@ornek", query: {} }, rival: { user: "rakip", label: "@rakip", query: {} }, options: {} }));
    let tok = null;
    if (I.token) { const d = el("details", "token"), s = el("summary", "", "Limit hatası alıyorum"); tok = el("input"); tok.type = "password"; tok.placeholder = "ghp_… (isteğe bağlı)"; tok.setAttribute("aria-label", "GitHub token"); tok.autocomplete = "off"; d.append(s, el("p", "", "GitHub, girişsiz isteklerde saatte 60 sorguya izin verir. Daha fazlası için kendi token'ını kullanabilirsin. Salt okunur herkese açık veriler için gerekli en düşük yetkileri seç; token bu sekmenin belleğinde tutulur ve GitHub API isteklerinde GitHub'a gönderilir. Güvenmediğin cihazlarda token kullanma."), tok); below.append(d); }
    f.append(below);
    f.addEventListener("submit", (e) => {
      e.preventDefault(); W.showErr("");
      const base = { platform: plat && plat.value }, a = p.makeInput({ ...base, user: inp.value });
      if (a.error) { W.showErr(a.error); return; }
      let rival = null;
      if (rv && !rv.hidden && rin.value.trim()) {
        const b = p.makeInput({ ...base, user: rin.value });
        if (b.error) { W.showErr("Rakibin kullanıcı adı geçerli görünmüyor."); return; }
        if (JSON.stringify(a.query) === JSON.stringify(b.query)) { W.showErr("Rakibin senden farklı biri olmalı."); return; }
        rival = b;
      }
      go.disabled = true; W.run({ src: p.id, input: a, rival, year: +ysel.value, token: tok && tok.value.trim(), options: {} });
    });
    return f;
  }

  /* ---- dosya yüklemeli kaynaklar ---- */
  function fileForm(p) {
    const I = p.input, box = el("div", "form"); box.style.display = "block";
    const drop = el("label", "drop"), fi = el("input"); fi.type = "file"; fi.accept = I.accept; if (I.multiple) fi.multiple = true; drop.append(el("b", "", I.dropTitle), el("span", "", I.dropHint), fi);
    box.append(drop);
    if (I.how) { const d = el("details", "how"), ol = el("ol"); I.how.forEach((t) => ol.append(el("li", "", t))); d.append(el("summary", "", "Dosyayı nasıl alırım?"), ol); box.append(d); }
    const info = el("div", "info"); info.hidden = true; box.append(info);
    const ysel = el("select"); ysel.id = "yearSel"; ysel.setAttribute("aria-label", "Yıl"); ysel.hidden = true; ysel.style.cssText = "height:58px;border:2.5px solid var(--ink);border-radius:14px;background:#fff;padding:0 14px;font-weight:700;font-size:16px;margin-top:12px";
    const opts = el("div", "optrow"), optEls = {};
    (I.options || []).forEach((o) => { const l = el("label"), c = el("input"); c.type = "checkbox"; c.checked = !!o.def; optEls[o.id] = c; l.append(c, el("span", "", o.label)); opts.append(l); });
    opts.hidden = true; box.append(ysel, opts);
    const go = el("button", "go", "Hikâyemi hazırla"); go.type = "button"; go.id = "goBtn"; go.disabled = true; go.style.cssText += ";margin-top:14px;width:100%"; box.append(go);
    const below = el("div", "below"), row = el("div", "textrow"); below.append(row);
    const demo = el("button", "textbtn", I.demoLabel || "Örnek sohbeti dene"); demo.type = "button"; if (hasDemo(p)) { row.append(demo); box.append(below); }
    let file = null, files = [], meta = null;
    async function choose(list) {
      const fl = list[0]; file = fl; files = list; W.showErr(""); info.hidden = false; info.textContent = "Dosya okunuyor…"; go.disabled = true;
      try { meta = await p.inspect(I.multiple ? list : fl); info.textContent = meta.note; yearOptions(ysel, meta.years.map((y) => ({ y: y.y, label: `${y.y} (${new Intl.NumberFormat("tr-TR").format(y.n)} kayıt)` }))); ysel.value = meta.defaultYear; ysel.hidden = false; opts.hidden = false; go.disabled = false; }
      catch (e) { console.error(e); info.hidden = true; W.showErr((p.errMsg && p.errMsg(e, fl.name)) || "Bu dosya okunamadı."); }
    }
    fi.addEventListener("change", () => fi.files.length && choose([...fi.files]));
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { const fl = [...e.dataTransfer.files]; if (fl.length) choose(fl); });
    const optVals = () => Object.fromEntries(Object.entries(optEls).map(([k, c]) => [k, c.checked]));
    go.onclick = () => { if (!file) return; go.disabled = true; W.run({ src: p.id, input: { file, files, meta, label: file.name, query: {} }, year: +ysel.value, options: optVals() }); };
    demo.onclick = () => W.run({ src: p.id, demo: true, year: THIS_YEAR, input: { label: "örnek", query: {} }, options: optVals() });
    return box;
  }

  function select(id) {
    cur = id; const p = W.plugins[id];
    tiles.querySelectorAll(".tile[data-id]").forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.id === id)));
    panel.textContent = ""; W.showErr("");
    panel.append(p.input.kind === "file" ? fileForm(p) : userForm(p));
  }

  /* ---- başlangıç: bağlantıdan doğrudan açma ---- */
  function boot() {
    buildTiles();
    const q = new URLSearchParams(location.search), want = q.get("s");
    if (q.get("demo") && W.demos) {
      const p = W.plugins[want || W.list()[0].id]; if (p && hasDemo(p)) { select(p.id); W.run({ src: p.id, demo: true, year: +q.get("y") || THIS_YEAR, input: { user: "ornek", label: "@ornek", query: {} }, rival: q.get("duel") ? { user: "rakip", label: "@rakip", query: {} } : null, options: {} }); return; }
    }
    const order = W.list().filter((p) => !want || p.id === want);
    for (const p of order) {
      const r = p.fromQuery && p.fromQuery(q);
      if (r) { select(p.id); const y = r.year >= THIS_YEAR - 8 && r.year <= THIS_YEAR ? r.year : THIS_YEAR; W.run({ src: p.id, input: r.input, rival: r.rival || null, year: y, options: {} }); return; }
    }
    select(W.list()[0].id);
  }
  function missing() {
    tiles.textContent = ""; panel.textContent = "";
    const box = el("div", "info"); box.style.cssText = "margin-top:20px;border-color:#B42318;color:#7A1A12";
    box.innerHTML = "<b>Kaynak dosyaları yüklenemedi.</b><br>Kaynak <code>.js</code> dosyalarının index.html ile <b>aynı klasörde</b> olduğundan emin ol, sonra sayfayı yenile (Ctrl+F5).";
    panel.append(box);
  }
  /* tek kaynaklı derleme: seçici yok, açılış ekranı kaynağın kendi temasıyla gelir */
  async function solo(p) {
    await W.setLanding(p.theme); tiles.hidden = true;
    const h1 = document.querySelector("#landing h1"), lead = document.querySelector("#landing .lead"), parts = p.name.split(" ");
    if (h1) h1.innerHTML = parts.length > 1 ? `${parts[0]}<br>${parts.slice(1).join(" ")}` : p.name;
    if (lead) lead.textContent = `${p.blurb} Kaydırmalı kartlar, Instagram'a hazır görseller ve Reels videosu.`;
    document.title = p.name;
  }
  (async () => {
    if (!W.list().length) { missing(); return; }
    if (W.list().length === 1) await solo(W.list()[0]);
    boot(); if (!new URLSearchParams(location.search).toString()) W.show("landing");
    addEventListener("resize", () => { if (!$("landing").hidden) W.show("landing"); });
  })();
})();
