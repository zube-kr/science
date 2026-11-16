/* =====================================================================
   각종문서변환 — 공통 도구 (모든 기능이 함께 씀)
   - 파일은 서버로 보내지 않고 브라우저 안에서만 처리한다.
   - 라이브러리는 사이트 안 lib/ 폴더에서 필요할 때만 불러온다(학교망 CDN 차단 대비).
   ===================================================================== */
"use strict";
const DT = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})){
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

  /* ---------- 라이브러리 ---------- */
  const LIBS = {
    pdfjs: ["lib/pdfjs-3.11.174.min.js"],
    pdflib: ["lib/pdf-lib-1.17.1.min.js"],
    jszip: ["lib/jszip-3.10.1.min.js"],
    html2canvas: ["lib/html2canvas-1.4.1.min.js"],
    docx: ["lib/jszip-3.10.1.min.js", "lib/docx-preview-0.3.3.min.js"],
    xlsx: ["lib/xlsx-0.18.5.full.min.js"],
    pptxgen: ["lib/pptxgen-3.12.0.bundle.js"],
    tesseract: ["lib/tesseract/tesseract.min.js"],
  };
  const loaded = {};
  function loadScript(src){
    if (!loaded[src]) loaded[src] = new Promise((ok, bad) => {
      const s = document.createElement("script"); s.src = src; s.onload = ok;
      s.onerror = () => { delete loaded[src]; bad(new Error("라이브러리를 불러오지 못했어요: " + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  async function need(...names){
    for (const n of names) for (const src of LIBS[n]) await loadScript(src);
    if (names.includes("pdfjs") && window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdfjs-3.11.174.worker.min.js";
  }

  /* ---------- 숫자·이름 ---------- */
  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : b >= 1024 ? Math.round(b / 1024) + " KB" : b + " B";
  const baseName = n => String(n).replace(/\.[^.]+$/, "");
  const extOf = n => (String(n).match(/\.([^.]+)$/) || [, ""])[1].toLowerCase();
  const today = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; };

  /* "1-3, 5, 8-" 같은 범위를 [[0,1,2],[4],[7..n-1]] 로 */
  function parseRanges(str, n){
    const out = [];
    for (const part of String(str).split(/[,\s]+/).filter(Boolean)){
      const m = part.match(/^(\d*)\s*[-~]\s*(\d*)$/);
      let a, b;
      if (m){ a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : n; }
      else if (/^\d+$/.test(part)){ a = b = +part; }
      else throw new Error(`'${part}'는 이해할 수 없는 범위예요. 예) 1-3, 5, 8-`);
      if (a < 1 || b > n || a > b) throw new Error(`'${part}' 범위가 1~${n}쪽을 벗어나요.`);
      const r = []; for (let i = a; i <= b; i++) r.push(i - 1); out.push(r);
    }
    if (!out.length) throw new Error("범위를 입력해 주세요. 예) 1-3, 5");
    return out;
  }

  /* ---------- 저장 ---------- */
  function save(data, name, mime = "application/pdf"){
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    return blob.size;
  }
  async function saveZip(entries, zipName){
    await need("jszip");
    const zip = new JSZip();
    for (const e of entries) zip.file(e.name, e.data);
    const blob = await zip.generateAsync({ type: "blob" });
    return save(blob, zipName, "application/zip");
  }
  /* 여러 결과: 1개면 그대로, 여러 개면 묶어서(zip) */
  async function saveMany(entries, zipName){
    if (entries.length === 1) return save(entries[0].data, entries[0].name, entries[0].mime);
    return saveZip(entries, zipName);
  }

  /* ---------- PDF 읽기·그리기 ---------- */
  async function openPdf(file){
    await need("pdfjs");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let doc;
    try{ doc = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; }
    catch (e){
      if (e && e.name === "PasswordException") throw new Error(`'${file.name}'에 암호가 걸려 있어요. 암호를 푼 PDF를 올려 주세요.`);
      throw new Error(`'${file.name}'을(를) 열 수 없어요. 손상된 PDF라면 'PDF 복구'를 먼저 써 보세요.`);
    }
    return { name: file.name, size: file.size, bytes, doc, numPages: doc.numPages };
  }
  async function loadLib(bytes){
    await need("pdflib");
    return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  }
  /* 페이지를 캔버스로: scale 또는 maxSide(긴 변 픽셀) 지정. noText 면 글자만 빼고 그림 */
  async function renderPage(doc, pageNo, { scale, maxSide, rotation = 0, noText = false, background = "#fff" } = {}){
    const page = await doc.getPage(pageNo);
    const rot = ((page.rotate + rotation) % 360 + 360) % 360;
    const vp1 = page.getViewport({ scale: 1, rotation: rot });
    let s = Math.min(scale || Infinity, maxSide ? maxSide / Math.max(vp1.width, vp1.height) : Infinity);
    if (!isFinite(s)) s = 1;
    const vp = page.getViewport({ scale: s, rotation: rot });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    const ctx = c.getContext("2d");
    if (background){ ctx.fillStyle = background; ctx.fillRect(0, 0, c.width, c.height); }
    if (noText){ ctx.fillText = () => {}; ctx.strokeText = () => {}; }
    await page.render({ canvasContext: ctx, viewport: vp, background: background || undefined }).promise;
    page.cleanup();
    return { canvas: c, viewport: vp, page, scale: s, widthPt: vp1.width, heightPt: vp1.height };
  }
  const canvasBytes = (canvas, type = "image/jpeg", q = .9) => new Promise((ok, bad) =>
    canvas.toBlob(b => b ? b.arrayBuffer().then(a => ok(new Uint8Array(a))) : bad(new Error("이미지를 만들 수 없어요(너무 큰 페이지일 수 있어요).")), type, q));

  /* 캔버스 → pdf-lib 페이지 (widthPt × heightPt 크기) */
  async function addCanvasPage(pdfDoc, canvas, widthPt, heightPt, { type = "image/jpeg", quality = .88 } = {}){
    const bytes = await canvasBytes(canvas, type, quality);
    const img = type === "image/png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const pg = pdfDoc.addPage([widthPt, heightPt]);
    pg.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt });
    return pg;
  }

  /* 한글 글자를 그림으로 (PDF 기본 글꼴은 한글이 없으므로 그림으로 찍는다) */
  function textCanvas(text, { size = 48, color = "#000", bold = false, family = "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','Noto Sans KR',sans-serif", pad = .12, lineHeight = 1.25, align = "left", italic = false, bg = null } = {}){
    const lines = String(text).split(/\r?\n/);
    const c = document.createElement("canvas"), g = c.getContext("2d");
    const font = `${italic ? "italic " : ""}${bold ? "700" : "400"} ${size}px ${family}`;
    g.font = font;
    const w = Math.max(1, ...lines.map(l => g.measureText(l || " ").width));
    const p = Math.round(size * pad);
    c.width = Math.ceil(w + p * 2); c.height = Math.ceil(lines.length * size * lineHeight + p * 2);
    if (bg){ g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.font = font; g.fillStyle = color; g.textBaseline = "middle"; g.textAlign = align;
    const ax = align === "center" ? c.width / 2 : align === "right" ? c.width - p : p;
    lines.forEach((l, i) => g.fillText(l, ax, p + (i + .5) * size * lineHeight));
    return c;
  }

  /* ---------- 이미지 파일 → 캔버스(휴대폰 사진 방향 자동 보정) ---------- */
  async function imageToCanvas(file, maxSide = 0){
    let bmp;
    try{ bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e){
      bmp = await new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error(`'${file.name}'은(는) 열 수 없는 그림이에요.`)); im.src = URL.createObjectURL(file); });
    }
    let w = bmp.width, hh = bmp.height;
    if (maxSide && Math.max(w, hh) > maxSide){ const k = maxSide / Math.max(w, hh); w = Math.round(w * k); hh = Math.round(hh * k); }
    const c = document.createElement("canvas"); c.width = w; c.height = hh;
    c.getContext("2d").drawImage(bmp, 0, 0, w, hh);
    if (bmp.close) bmp.close();
    return c;
  }
  /* JPEG 의 EXIF 방향 값 (1이면 그대로) */
  function jpegOrientation(bytes){
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1;
    let i = 2;
    while (i < bytes.length - 10){
      if (bytes[i] !== 0xFF) return 1;
      const m = bytes[i + 1], len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (m === 0xE1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78){
        const t = i + 10, le = bytes[t] === 0x49;
        const r16 = o => le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
        const r32 = o => le ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
        const ifd = t + r32(t + 4), n = r16(ifd);
        for (let k = 0; k < n; k++){ const e = ifd + 2 + k * 12; if (r16(e) === 0x0112) return r16(e + 8); }
        return 1;
      }
      if (m === 0xDA) return 1;
      i += 2 + len;
    }
    return 1;
  }

  /* ---------- 화면 조각 ---------- */
  function dropZone({ accept, multiple = true, title, hint, onFiles, capture }){
    const input = h("input", { type: "file", accept, multiple: multiple || null, hidden: true, capture: capture || null });
    const el = h("div", { class: "drop", tabindex: 0, role: "button" },
      h("div", { class: "drop-ic", html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3-3 3 3"/></svg>' }),
      h("b", {}, title || "파일을 여기에 끌어다 놓거나 눌러서 선택하세요"),
      h("span", {}, hint || ""), input);
    const pick = () => input.click();
    el.addEventListener("click", e => { if (e.target !== input) pick(); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); pick(); } });
    input.addEventListener("change", () => { const fs = [...input.files]; input.value = ""; if (fs.length) onFiles(fs); });
    ["dragenter", "dragover"].forEach(t => el.addEventListener(t, e => { e.preventDefault(); el.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => el.addEventListener(t, e => { e.preventDefault(); el.classList.remove("over"); }));
    el.addEventListener("drop", e => { const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) onFiles(multiple ? fs : fs.slice(0, 1)); });
    el.pick = pick;
    return el;
  }
  function filterFiles(files, exts, label){
    const ok = files.filter(f => exts.includes(extOf(f.name)));
    const bad = files.filter(f => !exts.includes(extOf(f.name)));
    if (bad.length) toast(`${bad.map(f => f.name).join(", ")}: ${label} 파일만 올릴 수 있어요.`, "err");
    return ok;
  }
  function statusBox(){
    const el = h("div", { class: "status" });
    el.set = (msg, cls = "") => { el.className = "status " + cls; el.innerHTML = msg || ""; };
    el.busy = msg => el.set(`<span class="spin"></span> ${msg}`);
    el.ok = msg => el.set("✅ " + msg, "ok");
    el.err = msg => el.set("⚠️ " + msg, "err");
    return el;
  }
  function progress(){
    const bar = h("div", { class: "prog hidden" }, h("i"));
    bar.set = (v, n) => { bar.classList.remove("hidden"); bar.firstChild.style.width = Math.round(Math.min(1, v / (n || 1)) * 100) + "%"; };
    bar.done = () => { bar.classList.add("hidden"); bar.firstChild.style.width = "0"; };
    return bar;
  }
  let toastT = 0;
  function toast(msg, cls = ""){
    let t = $("#dt-toast");
    if (!t){ t = h("div", { id: "dt-toast" }); document.body.appendChild(t); }
    t.className = "show " + cls; t.textContent = msg;
    clearTimeout(toastT); toastT = setTimeout(() => t.className = "", 3800);
  }
  /* 옵션 줄: [{label, el}] */
  function field(label, control, note){
    return h("label", { class: "field" }, h("span", { class: "fl" }, label), control, note ? h("small", {}, note) : null);
  }
  function select(options, value){
    const s = h("select");
    for (const [v, t] of options) s.append(h("option", { value: v, selected: String(v) === String(value) || null }, t));
    return s;
  }
  function seg(options, value, onChange){
    const wrap = h("div", { class: "seg" });
    wrap.value = value;
    for (const [v, t] of options){
      const b = h("button", { type: "button", class: String(v) === String(value) ? "on" : "" }, t);
      b.onclick = () => { wrap.value = v; wrap.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); onChange && onChange(v); };
      wrap.append(b);
    }
    return wrap;
  }
  function button(text, { primary = false, onClick, icon } = {}){
    return h("button", { type: "button", class: "btn" + (primary ? " pri" : ""), onclick: onClick, html: (icon || "") + esc(text) });
  }
  async function guard(status, fn){
    try{ return await fn(); }
    catch (e){ console.error(e); status.err(esc(e.message || String(e))); }
  }

  /* ---------- 페이지 썸네일 격자 ----------
     items: [{ src(pdf 정보), index, rot, sel, del, blank:{w,h} }]
     opts: { select:true, del:true, rotate:true, reorder:true, onChange } */
  class PageGrid{
    constructor(opts = {}){
      this.opts = Object.assign({ select: true, del: false, rotate: false, reorder: false, thumb: 220 }, opts);
      this.items = []; this.el = h("div", { class: "pgrid" + (this.opts.reorder ? " reorder" : "") });
      this.queue = Promise.resolve();
    }
    add(src, indices){
      for (const i of indices ?? [...Array(src.numPages).keys()]) this.items.push({ id: Math.random().toString(36).slice(2), src, index: i, rot: 0, sel: false, del: false });
      this.render();
    }
    addBlank(after, w = 595.28, hh = 841.89){
      const it = { id: Math.random().toString(36).slice(2), blank: { w, h: hh }, rot: 0, sel: false, del: false };
      const i = after == null ? this.items.length : this.items.indexOf(after) + 1;
      this.items.splice(i, 0, it); this.render();
    }
    clear(){ this.items = []; this.render(); }
    live(){ return this.items.filter(i => !i.del); }
    selected(){ return this.items.filter(i => i.sel && !i.del); }
    render(){
      const keep = new Map([...this.el.children].map(c => [c.dataset.id, c]));
      this.el.innerHTML = "";
      let n = 0;
      for (const it of this.items){
        n++;
        let card = keep.get(it.id);
        if (!card){ card = this.card(it); }
        card.querySelector(".pnum").textContent = n;
        card.classList.toggle("sel", it.sel); card.classList.toggle("del", it.del);
        const deg = card.querySelector(".pdeg"); deg.textContent = it.rot % 360 ? (it.rot > 0 ? "+" : "") + it.rot + "°" : "";
        const x = card.querySelector(".px"); if (x){ x.textContent = it.del ? "↩" : "✕"; x.title = it.del ? "되살리기" : "빼기"; }
        this.el.append(card);
        this.place(it, card);
      }
      if (!this.items.length) this.el.append(h("div", { class: "pgrid-empty" }, "파일을 올리면 페이지가 여기에 보여요."));
      this.opts.onChange && this.opts.onChange(this);
    }
    card(it){
      const o = this.opts;
      const card = h("div", { class: "pcard", "data-id": it.id, draggable: o.reorder ? "true" : null },
        o.select ? h("span", { class: "pchk" }) : null,
        h("div", { class: "pthumb" }, h("div", { class: "ploading" }, it.blank ? "빈 페이지" : "…")),
        h("div", { class: "ptools" },
          o.rotate ? h("button", { type: "button", title: "왼쪽으로 돌리기", onclick: e => { e.stopPropagation(); it.rot -= 90; this.render(); }, html: ICON.rotL }) : null,
          o.rotate ? h("button", { type: "button", title: "오른쪽으로 돌리기", class: "acc", onclick: e => { e.stopPropagation(); it.rot += 90; this.render(); }, html: ICON.rotR }) : null,
          o.reorder ? h("button", { type: "button", title: "앞으로", onclick: e => { e.stopPropagation(); this.move(it, -1); }, html: "◀" }) : null,
          o.reorder ? h("button", { type: "button", title: "뒤로", onclick: e => { e.stopPropagation(); this.move(it, 1); }, html: "▶" }) : null,
          o.blank ? h("button", { type: "button", title: "뒤에 빈 페이지 넣기", onclick: e => { e.stopPropagation(); this.addBlank(it, ...this.sizeOf(it)); }, html: "＋" }) : null),
        o.del ? h("button", { type: "button", class: "px", onclick: e => { e.stopPropagation(); it.del = !it.del; it.sel = false; this.render(); } }, "✕") : null,
        h("span", { class: "pdot", style: { background: it.src?.color || "#bbb" } }),
        h("span", { class: "pnum" }), h("span", { class: "pdeg" }));
      if (o.select) card.addEventListener("click", () => { if (it.del) return; it.sel = !it.sel; this.render(); });
      if (o.reorder){
        card.addEventListener("dragstart", e => { this.dragging = it; card.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
        card.addEventListener("dragend", () => { card.classList.remove("dragging"); this.dragging = null; });
        card.addEventListener("dragover", e => { if (this.dragging && this.dragging !== it){ e.preventDefault(); card.classList.add("dropto"); } });
        card.addEventListener("dragleave", () => card.classList.remove("dropto"));
        card.addEventListener("drop", e => {
          e.preventDefault(); card.classList.remove("dropto");
          const d = this.dragging; if (!d || d === it) return;
          this.items.splice(this.items.indexOf(d), 1);
          this.items.splice(this.items.indexOf(it) + (e.offsetX > card.clientWidth / 2 ? 1 : 0), 0, d);
          this.render();
        });
      }
      this.queue = this.queue.then(() => this.draw(it, card)).catch(e => console.warn(e));
      return card;
    }
    sizeOf(it){ return it.blank ? [it.blank.w, it.blank.h] : [it.w || 595.28, it.h || 841.89]; }
    move(it, d){ const i = this.items.indexOf(it), j = i + d; if (j < 0 || j >= this.items.length) return; this.items.splice(i, 1); this.items.splice(j, 0, it); this.render(); }
    async draw(it, card){
      const box = card.querySelector(".pthumb");
      let c;
      if (it.blank){ c = document.createElement("canvas"); const k = 160 / Math.max(it.blank.w, it.blank.h); c.width = it.blank.w * k; c.height = it.blank.h * k; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); it.w = it.blank.w; it.h = it.blank.h; }
      else { const r = await renderPage(it.src.doc, it.index + 1, { maxSide: this.opts.thumb }); c = r.canvas; it.w = r.widthPt; it.h = r.heightPt; }
      it.cw = c.width; it.ch = c.height;
      box.innerHTML = ""; box.append(c);
      this.place(it, card);
    }
    place(it, card){
      const c = card.querySelector(".pthumb canvas"); if (!c) return;
      const B = card.querySelector(".pthumb").clientWidth || 150;
      const turned = Math.abs(it.rot) % 180 === 90;
      const W = turned ? it.ch : it.cw, H = turned ? it.cw : it.ch;
      const k = Math.min(B / W, B / H) * .94;
      c.style.width = it.cw * k + "px"; c.style.height = it.ch * k + "px";
      c.style.transform = `translate(-50%,-50%) rotate(${it.rot}deg)`;
    }
    /* 현재 순서·회전대로 새 PDF 만들기 */
    async build(list = this.live()){
      await need("pdflib");
      const out = await PDFLib.PDFDocument.create();
      const cache = new Map();
      for (const it of list){
        if (it.blank){ const p = out.addPage([it.blank.w, it.blank.h]); if (it.rot) p.setRotation(PDFLib.degrees(((it.rot % 360) + 360) % 360)); continue; }
        if (!cache.has(it.src)) cache.set(it.src, await loadLib(it.src.bytes));
        const [p] = await out.copyPages(cache.get(it.src), [it.index]);
        if (it.rot) p.setRotation(PDFLib.degrees((((p.getRotation().angle + it.rot) % 360) + 360) % 360));
        out.addPage(p);
      }
      return out.save();
    }
  }

  const ICON = {
    rotR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
    rotL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  };
  const COLORS = ["#f0743a", "#4f46e5", "#16a34a", "#db2777", "#0891b2", "#ca8a04", "#7c3aed", "#dc2626"];
  let colorN = 0;
  const nextColor = () => COLORS[colorN++ % COLORS.length];

  /* 파일 목록(칩) + 순서 바꾸기 */
  function fileList({ onChange, reorder = true }){
    const el = h("div", { class: "flist" });
    el.items = [];
    el.render = () => {
      el.innerHTML = "";
      el.items.forEach((it, i) => {
        el.append(h("div", { class: "fitem" },
          h("span", { class: "fdot", style: { background: it.color || "#999" } }),
          h("span", { class: "fname", title: it.name }, it.name),
          h("span", { class: "fmeta" }, it.meta || ""),
          reorder ? h("button", { type: "button", title: "위로", disabled: i === 0 || null, onclick: () => { el.items.splice(i - 1, 0, el.items.splice(i, 1)[0]); el.render(); } }, "▲") : null,
          reorder ? h("button", { type: "button", title: "아래로", disabled: i === el.items.length - 1 || null, onclick: () => { el.items.splice(i + 1, 0, el.items.splice(i, 1)[0]); el.render(); } }, "▼") : null,
          h("button", { type: "button", class: "rm", title: "빼기", onclick: () => { el.items.splice(i, 1); el.render(); } }, "✕")));
      });
      onChange && onChange(el.items);
    };
    return el;
  }

  /* ---------- 도구 등록 ---------- */
  const tools = [];
  function register(t){ tools.push(t); }

  return { $, h, esc, sleep, tick, need, loadScript, fmtSize, baseName, extOf, today, parseRanges, save, saveZip, saveMany,
    openPdf, loadLib, renderPage, canvasBytes, addCanvasPage, textCanvas, imageToCanvas, jpegOrientation,
    dropZone, filterFiles, statusBox, progress, toast, field, select, seg, button, guard, PageGrid, ICON, nextColor, fileList,
    tools, register };
})();
