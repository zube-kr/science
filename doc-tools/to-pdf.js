/* PDF로 변환: JPG · 워드 · 파워포인트 · 엑셀 · HTML → PDF */
"use strict";
(() => {
const { h, esc } = DT;
const tileIcon = (t, bg) => ({ icon: t, tile: bg });
const PAGE = { a4: [595.28, 841.89], letter: [612, 792], b5: [498.9, 708.66] };

/* ===================================================================
   화면(DOM) → PDF 페이지: html2canvas 로 페이지 높이만큼씩 잘라 그린다.
   글줄 중간이 잘리지 않도록 문단·표 줄의 아래 경계에서 끊는다.
   =================================================================== */
function breakPoints(node){
  const top = node.getBoundingClientRect().top, pts = new Set();
  node.querySelectorAll("p,li,tr,h1,h2,h3,h4,h5,h6,img,table,pre,blockquote,dt,dd,figure,hr,section,article,div:not(:has(div,p,table,li))").forEach(el => {
    const r = el.getBoundingClientRect(); if (r.height > 0) pts.add(Math.round(r.bottom - top));
  });
  return [...pts].sort((a, b) => a - b);
}
/* node 를 widthPx 폭 그대로, pageHpx 높이 단위로 나눠 pdf 에 추가 */
async function domToPdf(pdf, node, { pageWpt, pageHpt, marginPx = 0, scale = 2, onProg, firstTopKeep = false } = {}){
  await DT.need("html2canvas");
  const rect = node.getBoundingClientRect();
  const W = Math.ceil(node.scrollWidth || rect.width), Htot = Math.ceil(node.scrollHeight || rect.height);
  const pxPerPt = W / pageWpt, pageH = Math.floor(pageHpt * pxPerPt), contentH = pageH - 2 * marginPx;
  const bps = breakPoints(node);
  const cuts = []; let y = 0;
  while (y < Htot - 2){
    const room = (firstTopKeep && !cuts.length ? pageH - marginPx : contentH);
    let end = y + room;
    if (end < Htot){
      const cand = bps.filter(b => b > y + room * .55 && b <= end);
      if (cand.length) end = cand[cand.length - 1];
    } else end = Htot;
    cuts.push([y, end]); y = end;
  }
  const doc = node.ownerDocument;
  for (let i = 0; i < cuts.length; i++){
    const [a, b] = cuts[i];
    const c = await html2canvas(node, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false,
      /* html2canvas 의 x·y 는 요소 기준 위치 */ x: 0, y: a, width: W, height: b - a, windowWidth: Math.max(W, doc.documentElement.scrollWidth), windowHeight: Math.max(Htot + 200, doc.documentElement.scrollHeight) });
    const page = document.createElement("canvas"); page.width = W * scale; page.height = pageH * scale;
    const g = page.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, page.width, page.height);
    const topPad = firstTopKeep && i === 0 ? 0 : marginPx;
    g.drawImage(c, 0, topPad * scale);
    await DT.addCanvasPage(pdf, page, pageWpt, pageHpt, { quality: .9 });
    onProg && onProg(i + 1, cuts.length); await DT.tick();
  }
  return cuts.length;
}
DT.domToPdf = domToPdf;

/* 화면 밖 작업 공간 */
function stageBox(widthPx){
  const box = h("div", { style: { position: "fixed", left: "-20000px", top: "0", width: widthPx + "px", background: "#fff", zIndex: -1 } });
  document.body.appendChild(box); window.__dtCleanup.push(() => box.remove());
  return box;
}

/* ------------------------------------------------------------------ */
DT.register({ id: "jpg2pdf", group: "to", order: 1, name: "JPG → PDF 변환", desc: "사진·그림을 PDF로", ...tileIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>', "#f2a900"),
  long: "JPG·PNG·WEBP·GIF 그림을 PDF로 만들어요. 휴대폰 사진의 방향도 자동으로 맞춰요. ▲▼로 순서를 바꿀 수 있어요.",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let size = "a4", orient = "auto", margin = "small", fit = "fit", sep = "one";
    const list = DT.fileList({ onChange: it => { go.disabled = !it.length; } });
    const drop = DT.dropZone({ accept: "image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp", hint: "그림 파일을 여러 개 한꺼번에 올릴 수 있어요", onFiles: async fs => {
      for (const f of DT.filterFiles(fs, ["jpg", "jpeg", "png", "webp", "gif", "bmp", "jfif"], "그림(JPG·PNG 등)")){
        const thumb = h("img", { src: URL.createObjectURL(f) });
        list.items.push({ name: f.name, meta: DT.fmtSize(f.size), file: f, color: "#f2a900" });
        list.items[list.items.length - 1].thumb = thumb;
      }
      list.render(); drop.classList.add("small");
    } });
    const origRender = list.render;
    list.render = () => { origRender(); list.querySelectorAll(".fitem").forEach((el, i) => list.items[i]?.thumb && el.prepend(list.items[i].thumb.cloneNode())); };
    const go = DT.button("PDF로 만들기", { primary: true, icon: DT.ICON.dl }); go.classList.add("big"); go.disabled = true;
    go.onclick = () => DT.guard(st, async () => {
      await DT.need("pdflib");
      const docs = []; let pdf = await PDFLib.PDFDocument.create();
      for (let i = 0; i < list.items.length; i++){
        const it = list.items[i]; st.busy(`${i + 1}/${list.items.length} ${esc(it.name)}`);
        const raw = new Uint8Array(await it.file.arrayBuffer()), ext = DT.extOf(it.name);
        let img, iw, ih;
        if ((ext === "jpg" || ext === "jpeg" || ext === "jfif") && DT.jpegOrientation(raw) === 1){ img = await pdf.embedJpg(raw); iw = img.width; ih = img.height; }
        else if (ext === "png"){ img = await pdf.embedPng(raw); iw = img.width; ih = img.height; }
        else { const c = await DT.imageToCanvas(it.file, 4000); img = await pdf.embedJpg(await DT.canvasBytes(c, "image/jpeg", .9)); iw = c.width; ih = c.height; }
        let W, H;
        if (size === "img"){ W = iw * .75; H = ih * .75; }
        else { [W, H] = PAGE[size]; const land = orient === "land" || (orient === "auto" && iw > ih); if (land) [W, H] = [H, W]; }
        const m = size === "img" ? 0 : { none: 0, small: 20, big: 48 }[margin];
        let w, hh;
        if (fit === "fill" && size !== "img"){ const k = Math.max((W - 2 * m) / iw, (H - 2 * m) / ih); w = iw * k; hh = ih * k; }
        else { const k = Math.min((W - 2 * m) / iw, (H - 2 * m) / ih); w = iw * k; hh = ih * k; }
        const page = pdf.addPage([W, H]);
        page.drawImage(img, { x: (W - w) / 2, y: (H - hh) / 2, width: w, height: hh });
        if (sep === "each"){ docs.push({ name: DT.baseName(it.name) + ".pdf", data: await pdf.save() }); pdf = await PDFLib.PDFDocument.create(); }
        prog.set(i + 1, list.items.length); await DT.tick();
      }
      prog.done();
      if (sep === "each") await DT.saveMany(docs, "그림_PDF.zip");
      else DT.save(await pdf.save(), (list.items.length === 1 ? DT.baseName(list.items[0].name) : "그림모음_" + DT.today()) + ".pdf");
      st.ok(`그림 ${list.items.length}장을 PDF로 만들었어요.`);
    });
    const sortBtn = h("button", { class: "mini", type: "button", onclick: () => { list.items.sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true })); list.render(); } }, "이름순 정렬");
    root.append(drop, list, h("div", { class: "row" }, sortBtn),
      h("div", { class: "opts" },
        DT.field("페이지 크기", DT.seg([["a4", "A4"], ["letter", "Letter"], ["img", "그림 크기 그대로"]], size, v => size = v)),
        DT.field("방향", DT.seg([["auto", "자동"], ["port", "세로"], ["land", "가로"]], orient, v => orient = v)),
        DT.field("여백", DT.seg([["none", "없음"], ["small", "좁게"], ["big", "넓게"]], margin, v => margin = v)),
        DT.field("맞춤", DT.seg([["fit", "전체 보이기"], ["fill", "꽉 채우기"]], fit, v => fit = v)),
        DT.field("저장", DT.seg([["one", "한 파일로"], ["each", "그림마다 따로"]], sep, v => sep = v)),
        go), prog, st);
  } });

/* ------------------------------------------------------------------ */
DT.register({ id: "word2pdf", group: "to", order: 2, name: "워드 → PDF 변환", desc: "DOCX 문서를 PDF로", ...tileIcon("W", "#2b579a"),
  long: "워드 문서(.docx)를 PDF로 바꿔요. 표·그림·머리글도 함께 옮겨요. (예전 .doc 파일은 워드에서 .docx로 다시 저장해서 올려 주세요. 한글 문서는 <a href='hwp-to-pdf.html'>HWP → PDF</a>를 쓰세요.)",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let file = null;
    const prev = h("div", { class: "stage hidden", style: { maxHeight: "520px" } });
    const drop = DT.dropZone({ accept: ".docx", multiple: false, hint: "워드 파일(.docx) 1개", onFiles: fs => DT.guard(st, async () => {
      const f = fs[0], ext = DT.extOf(f.name);
      if (ext === "doc") throw new Error("예전 형식(.doc)은 바로 열 수 없어요. 워드에서 '다른 이름으로 저장 → .docx'로 바꿔 주세요.");
      if (ext === "hwp" || ext === "hwpx") throw new Error("한글 문서는 'HWP → PDF 변환'을 써 주세요.");
      if (ext !== "docx") throw new Error("워드(.docx) 파일만 올릴 수 있어요.");
      file = f; drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${f.name} — 다른 파일로 바꾸려면 누르세요`;
      st.busy("문서를 여는 중…"); await DT.need("docx");
      prev.innerHTML = ""; const inner = h("div", { class: "docx-host" }); prev.append(inner); prev.classList.remove("hidden");
      await docx.renderAsync(await f.arrayBuffer(), inner, null, { className: "docx", inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, useBase64URL: true, experimental: true });
      inner.querySelectorAll("section.docx").forEach(s => { s.style.boxShadow = "0 4px 16px rgba(0,0,0,.15)"; s.style.marginBottom = "16px"; s.style.background = "#fff"; });
      st.set(`미리보기를 확인하고 'PDF로 저장'을 누르세요. (${inner.querySelectorAll("section.docx").length}개 구역)`);
      go.disabled = false;
    }) });
    const go = DT.button("PDF로 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big"); go.disabled = true;
    go.onclick = () => DT.guard(st, async () => {
      await DT.need("pdflib", "html2canvas");
      const pdf = await PDFLib.PDFDocument.create();
      // 화면 밖에서 원래 크기로 다시 그려서 페이지로 자른다
      const sections = [...prev.querySelectorAll("section.docx")];
      let n = 0;
      for (let si = 0; si < sections.length; si++){
        const s = sections[si];
        const cs = getComputedStyle(s), wpx = s.offsetWidth;
        const hpx = parseFloat(s.style.minHeight) * (s.style.minHeight.endsWith("pt") ? 4 / 3 : 1) || wpx * 297 / 210;
        const box = stageBox(wpx); const clone = s.cloneNode(true);
        Object.assign(clone.style, { boxShadow: "none", margin: "0", minHeight: "0" });
        // 스타일(<style>)도 같이 복사
        prev.querySelectorAll("style").forEach(x => box.append(x.cloneNode(true)));
        box.append(clone);
        await DT.tick();
        const padT = parseFloat(cs.paddingTop) || 72;
        st.busy(`${si + 1}/${sections.length}구역 PDF로 그리는 중…`);
        n += await domToPdf(pdf, clone, { pageWpt: wpx * .75, pageHpt: hpx * .75, marginPx: padT, firstTopKeep: true, onProg: prog.set });
        box.remove();
      }
      prog.done();
      DT.save(await pdf.save(), DT.baseName(file.name) + ".pdf");
      st.ok(`${n}쪽 PDF로 저장했어요. (글자는 그림으로 들어가요 — 글자 검색이 필요하면 'OCR PDF'를 이어서 쓰세요)`);
    });
    const printBtn = h("button", { class: "mini", type: "button", onclick: () => {
      const w = window.open("", "_blank"); if (!w) return DT.toast("팝업이 막혀 있어요.", "err");
      w.document.write(`<html><head><title>${esc(file?.name || "문서")}</title><style>@page{margin:0}body{margin:0}section.docx{box-shadow:none!important;margin:0!important;page-break-after:always}</style>${[...prev.querySelectorAll("style")].map(s => s.outerHTML).join("")}</head><body>${prev.querySelector(".docx-host")?.innerHTML || ""}</body></html>`);
      w.document.close(); setTimeout(() => w.print(), 600);
    } }, "🖨️ 인쇄 창으로 PDF 저장(글자 선택 가능)");
    root.append(drop, h("div", { class: "row" }, go, printBtn), prog, st, prev);
  } });

/* ------------------------------------------------------------------ */
/* ===== 파워포인트(.pptx) 그리기 — 슬라이드 XML 을 읽어 캔버스에 직접 그린다 ===== */
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const kids = (el, ns, name) => el ? [...el.children].filter(c => c.localName === name && (!ns || c.namespaceURI === ns)) : [];
const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
const path = (el, ...names) => { let e = el; for (const n of names){ e = e && [...e.children].find(c => c.localName === n); } return e || null; };
const FONT_KO = "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','Noto Sans KR',sans-serif";

class Pptx{
  static async open(buf){
    await DT.need("jszip");
    const p = new Pptx(); p.zip = await JSZip.loadAsync(buf); p.xml = {}; p.img = {};
    const pres = await p.part("ppt/presentation.xml");
    const sz = path(pres.documentElement, "sldSz");
    p.cx = +sz.getAttribute("cx"); p.cy = +sz.getAttribute("cy");
    const rels = await p.rels("ppt/presentation.xml");
    p.slides = kids(path(pres.documentElement, "sldIdLst"), NS_P, "sldId").map(s => rels[s.getAttributeNS(NS_R, "id")]).filter(Boolean);
    return p;
  }
  async part(name){
    if (!(name in this.xml)){
      const f = this.zip.file(name);
      this.xml[name] = f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null;
    }
    return this.xml[name];
  }
  async rels(name){
    const i = name.lastIndexOf("/"), relName = name.slice(0, i) + "/_rels/" + name.slice(i + 1) + ".rels";
    const d = await this.part(relName), out = {};
    if (!d) return out;
    for (const r of d.documentElement.children){
      let t = r.getAttribute("Target");
      if (r.getAttribute("TargetMode") === "External") continue;
      t = t.startsWith("/") ? t.slice(1) : resolve(name.slice(0, i), t);
      out[r.getAttribute("Id")] = t;
    }
    return out;
  }
  async image(name){
    if (!(name in this.img)){
      const f = this.zip.file(name);
      this.img[name] = f ? f.async("blob").then(b => createImageBitmap(b).catch(() => null)) : Promise.resolve(null);
    }
    return this.img[name];
  }
  /* 한 슬라이드를 W 픽셀 폭 캔버스로 */
  async render(index, W){
    const slidePath = this.slides[index];
    const slide = await this.part(slidePath), sRels = await this.rels(slidePath);
    const layoutPath = Object.values(sRels).find(t => /slideLayouts\//.test(t));
    const layout = layoutPath ? await this.part(layoutPath) : null, lRels = layoutPath ? await this.rels(layoutPath) : {};
    const masterPath = Object.values(lRels).find(t => /slideMasters\//.test(t));
    const master = masterPath ? await this.part(masterPath) : null, mRels = masterPath ? await this.rels(masterPath) : {};
    const themePath = Object.values(mRels).find(t => /theme\//.test(t));
    const theme = themePath ? await this.part(themePath) : null;
    const H = Math.round(W * this.cy / this.cx), k = W / this.cx;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const ctx = { g, k, W, H, theme, master, layout, slide, rels: { slide: sRels, layout: lRels, master: mRels }, pptx: this,
      clrMap: clrMapOf(master, slide), ptPx: W / (this.cx / 12700) };
    // 배경
    const bgFrom = [[slide, "slide"], [layout, "layout"], [master, "master"]].find(([d]) => d && path(d.documentElement, "cSld", "bg"));
    if (bgFrom) await drawBg(ctx, path(bgFrom[0].documentElement, "cSld", "bg"), bgFrom[1]);
    // 마스터·레이아웃의 장식 도형 (자리 표시자 제외)
    const show = d => d && d.documentElement.getAttribute("showMasterSp") !== "0";
    if (master && show(slide) && show(layout)) await drawTree(ctx, path(master.documentElement, "cSld", "spTree"), "master", true);
    if (layout && show(slide)) await drawTree(ctx, path(layout.documentElement, "cSld", "spTree"), "layout", true);
    await drawTree(ctx, path(slide.documentElement, "cSld", "spTree"), "slide", false);
    return c;
  }
}
function resolve(dir, rel){
  const parts = (dir + "/" + rel).split("/"), out = [];
  for (const p of parts){ if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
}
function clrMapOf(master, slide){
  const m = {}; const cm = master && path(master.documentElement, "clrMap");
  if (cm) for (const a of cm.attributes) m[a.name] = a.value;
  const ov = slide && path(slide.documentElement, "clrMapOvr", "overrideClrMapping");
  if (ov) for (const a of ov.attributes) m[a.name] = a.value;
  return m;
}
function schemeColor(ctx, name){
  name = ctx.clrMap[name] || name;
  const map = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" }; name = map[name] || name;
  const cs = ctx.theme && ctx.theme.getElementsByTagNameNS(NS_A, "clrScheme")[0];
  const e = cs && kid(cs, NS_A, name);
  if (!e) return name === "lt1" ? "FFFFFF" : "000000";
  const s = kid(e, NS_A, "srgbClr"), sys = kid(e, NS_A, "sysClr");
  return s ? s.getAttribute("val") : sys ? (sys.getAttribute("lastClr") || "000000") : "000000";
}
/* a:solidFill 등 안의 색 요소 → "rgba(...)" */
function colorOf(ctx, holder, phClr){
  if (!holder) return null;
  const e = [...holder.children].find(c => /^(srgbClr|schemeClr|sysClr|prstClr|scrgbClr|hslClr)$/.test(c.localName));
  if (!e) return null;
  let hex;
  if (e.localName === "srgbClr") hex = e.getAttribute("val");
  else if (e.localName === "schemeClr") hex = e.getAttribute("val") === "phClr" ? (phClr || "000000") : schemeColor(ctx, e.getAttribute("val"));
  else if (e.localName === "sysClr") hex = e.getAttribute("lastClr") || "000000";
  else if (e.localName === "prstClr") hex = ({ black: "000000", white: "FFFFFF", red: "FF0000", blue: "0000FF", green: "008000", yellow: "FFFF00", gray: "808080" })[e.getAttribute("val")] || "000000";
  else hex = "000000";
  let r = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16), a = 1;
  // 색 변형(밝게·어둡게·투명)
  let [hh, s, l] = rgb2hsl(r, gg, b);
  for (const m of e.children){
    const v = +m.getAttribute("val") / 100000;
    if (m.localName === "lumMod") l *= v; else if (m.localName === "lumOff") l += v;
    else if (m.localName === "alpha") a = v;
    else if (m.localName === "tint"){ [r, gg, b] = hsl2rgb(hh, s, l); r += (255 - r) * (1 - v); gg += (255 - gg) * (1 - v); b += (255 - b) * (1 - v); [hh, s, l] = rgb2hsl(r, gg, b); }
    else if (m.localName === "shade"){ [r, gg, b] = hsl2rgb(hh, s, l); r *= v; gg *= v; b *= v; [hh, s, l] = rgb2hsl(r, gg, b); }
    else if (m.localName === "satMod") s *= v;
  }
  [r, gg, b] = hsl2rgb(hh, s, Math.max(0, Math.min(1, l)));
  return `rgba(${r | 0},${gg | 0},${b | 0},${a})`;
}
function rgb2hsl(r, g, b){ r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn){ const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; } return [hh, s, l]; }
function hsl2rgb(hh, s, l){ if (!s) return [l * 255, l * 255, l * 255]; const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, hh + 1 / 3) * 255, f(p, q, hh) * 255, f(p, q, hh - 1 / 3) * 255]; }

async function drawBg(ctx, bg, level){
  const { g, W, H } = ctx;
  const pr = path(bg, "bgPr");
  if (pr){ await fillRect(ctx, pr, 0, 0, W, H, level); return; }
  const ref = path(bg, "bgRef");
  if (ref){
    const col = colorOf(ctx, ref); const idx = +ref.getAttribute("idx");
    if (idx >= 1001 && ctx.theme){
      const lst = ctx.theme.getElementsByTagNameNS(NS_A, "bgFillStyleLst")[0], f = lst && lst.children[idx - 1001];
      if (f){ const holder = { children: [f] }; await fillRect(ctx, holder, 0, 0, W, H, level, col && hexOfRgba(col)); return; }
    }
    if (col){ g.fillStyle = col; g.fillRect(0, 0, W, H); }
  }
}
const hexOfRgba = s => { const m = s.match(/\d+/g); return m ? m.slice(0, 3).map(x => (+x).toString(16).padStart(2, "0")).join("") : "000000"; };
/* spPr/bgPr 의 채우기를 사각형 영역에 칠하기 (그라데이션은 첫·끝 색으로) */
async function fillRect(ctx, holder, x, y, w, hh, level, phClr, shapePath){
  const { g } = ctx;
  const els = holder.children ? [...holder.children] : [];
  const f = els.find(e => /^(solidFill|gradFill|blipFill|noFill|pattFill)$/.test(e.localName));
  if (!f) return false;
  if (f.localName === "noFill") return true;
  let style = null;
  if (f.localName === "solidFill") style = colorOf(ctx, f, phClr);
  else if (f.localName === "pattFill") style = colorOf(ctx, path(f, "fgClr"), phClr);
  else if (f.localName === "gradFill"){
    const gs = [...(path(f, "gsLst")?.children || [])];
    if (gs.length){
      const lin = path(f, "lin"), ang = lin ? (+lin.getAttribute("ang") / 60000) * Math.PI / 180 : Math.PI / 2;
      const cx = x + w / 2, cy = y + hh / 2, r = Math.abs(w / 2 * Math.cos(ang)) + Math.abs(hh / 2 * Math.sin(ang));
      const gr = g.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      for (const s of gs) gr.addColorStop(Math.min(1, +s.getAttribute("pos") / 100000), colorOf(ctx, s, phClr) || "#fff");
      style = gr;
    }
  } else if (f.localName === "blipFill"){
    const blip = path(f, "blip"), id = blip && blip.getAttributeNS(NS_R, "embed");
    const relsets = level === "master" ? ctx.rels.master : level === "layout" ? ctx.rels.layout : ctx.rels.slide;
    const img = id && relsets[id] ? await ctx.pptx.image(relsets[id]) : null;
    if (img){ g.save(); if (shapePath){ shapePath(); g.clip(); } g.drawImage(img, x, y, w, hh); g.restore(); }
    return true;
  }
  if (style){ g.fillStyle = style; if (shapePath){ shapePath(); g.fill(); } else g.fillRect(x, y, w, hh); }
  return true;
}

/* 자리 표시자(제목·본문)를 레이아웃·마스터에서 찾기 */
function phOf(sp){ const ph = sp && sp.getElementsByTagNameNS(NS_P, "ph")[0]; return ph ? { type: ph.getAttribute("type") || "body", idx: ph.getAttribute("idx") } : null; }
function findPh(doc, ph){
  if (!doc || !ph) return null;
  const all = [...doc.getElementsByTagNameNS(NS_P, "sp")].filter(s => phOf(s));
  const norm = t => t === "ctrTitle" ? "title" : t === "subTitle" ? "body" : t;
  return all.find(s => ph.idx != null && phOf(s).idx === ph.idx) || all.find(s => norm(phOf(s).type) === norm(ph.type)) || null;
}
function xfrmOf(el){
  const x = el && (path(el, "spPr", "xfrm") || path(el, "xfrm") || path(el, "grpSpPr", "xfrm"));
  if (!x) return null;
  const off = path(x, "off"), ext = path(x, "ext");
  if (!off || !ext) return null;
  return { x: +off.getAttribute("x"), y: +off.getAttribute("y"), w: +ext.getAttribute("cx"), h: +ext.getAttribute("cy"),
    rot: +(x.getAttribute("rot") || 0) / 60000, flipH: x.getAttribute("flipH") === "1", flipV: x.getAttribute("flipV") === "1",
    chOff: path(x, "chOff"), chExt: path(x, "chExt") };
}

async function drawTree(ctx, tree, level, skipPh, T = { ox: 0, oy: 0, sx: 1, sy: 1 }){
  if (!tree) return;
  for (const el of tree.children){
    try{
      if (el.localName === "sp"){ if (skipPh && phOf(el)) continue; await drawShape(ctx, el, level, T); }
      else if (el.localName === "pic") await drawPic(ctx, el, level, T);
      else if (el.localName === "grpSp"){
        const xf = xfrmOf(el); if (!xf) { await drawTree(ctx, el, level, skipPh, T); continue; }
        const chx = xf.chOff ? +xf.chOff.getAttribute("x") : xf.x, chy = xf.chOff ? +xf.chOff.getAttribute("y") : xf.y;
        const chw = xf.chExt ? +xf.chExt.getAttribute("cx") || xf.w : xf.w, chh = xf.chExt ? +xf.chExt.getAttribute("cy") || xf.h : xf.h;
        const sx = xf.w / chw, sy = xf.h / chh;
        await drawTree(ctx, el, level, skipPh, { ox: T.ox + (xf.x - chx * sx) * T.sx, oy: T.oy + (xf.y - chy * sy) * T.sy, sx: T.sx * sx, sy: T.sy * sy });
      }
      else if (el.localName === "graphicFrame") await drawFrame(ctx, el, level, T);
      else if (el.localName === "AlternateContent"){ const fb = path(el, "Fallback") || path(el, "Choice"); if (fb) await drawTree(ctx, fb, level, skipPh, T); }
    }catch (e){ console.warn("도형 그리기 건너뜀", e); }
  }
}
function box(ctx, xf, T){ const k = ctx.k; return { x: (T.ox + xf.x * T.sx) * k, y: (T.oy + xf.y * T.sy) * k, w: xf.w * T.sx * k, h: xf.h * T.sy * k }; }
function withXf(ctx, b, xf, fn){
  const { g } = ctx; g.save();
  if (xf.rot || xf.flipH || xf.flipV){ g.translate(b.x + b.w / 2, b.y + b.h / 2); g.rotate(xf.rot * Math.PI / 180); g.scale(xf.flipH ? -1 : 1, xf.flipV ? -1 : 1); g.translate(-(b.x + b.w / 2), -(b.y + b.h / 2)); }
  const r = fn(); g.restore(); return r;
}
function shapePathFn(ctx, prst, b, geom){
  const { g } = ctx;
  return () => {
    g.beginPath();
    const { x, y, w, h: hh } = b;
    if (prst === "ellipse"){ g.ellipse(x + w / 2, y + hh / 2, Math.abs(w / 2), Math.abs(hh / 2), 0, 0, Math.PI * 2); }
    else if (prst === "roundRect"){ const adj = geom && geom.getElementsByTagNameNS(NS_A, "gd")[0]; const a = adj ? +adj.getAttribute("fmla").split(" ")[1] / 100000 : .16667; const r = Math.min(w, hh) * a; g.roundRect ? g.roundRect(x, y, w, hh, r) : g.rect(x, y, w, hh); }
    else if (prst === "triangle"){ g.moveTo(x + w / 2, y); g.lineTo(x + w, y + hh); g.lineTo(x, y + hh); g.closePath(); }
    else if (prst === "rtTriangle"){ g.moveTo(x, y); g.lineTo(x + w, y + hh); g.lineTo(x, y + hh); g.closePath(); }
    else if (prst === "diamond"){ g.moveTo(x + w / 2, y); g.lineTo(x + w, y + hh / 2); g.lineTo(x + w / 2, y + hh); g.lineTo(x, y + hh / 2); g.closePath(); }
    else if (prst === "line" || prst === "straightConnector1" || /Connector/.test(prst || "")){ g.moveTo(x, y); g.lineTo(x + w, y + hh); }
    else if (prst === "rightArrow"){ const t = hh * .25; g.moveTo(x, y + t); g.lineTo(x + w - hh / 2, y + t); g.lineTo(x + w - hh / 2, y); g.lineTo(x + w, y + hh / 2); g.lineTo(x + w - hh / 2, y + hh); g.lineTo(x + w - hh / 2, y + hh - t); g.lineTo(x, y + hh - t); g.closePath(); }
    else if (prst === "leftArrow"){ const t = hh * .25; g.moveTo(x + w, y + t); g.lineTo(x + hh / 2, y + t); g.lineTo(x + hh / 2, y); g.lineTo(x, y + hh / 2); g.lineTo(x + hh / 2, y + hh); g.lineTo(x + hh / 2, y + hh - t); g.lineTo(x + w, y + hh - t); g.closePath(); }
    else if (prst === "hexagon"){ const d = w * .25; g.moveTo(x + d, y); g.lineTo(x + w - d, y); g.lineTo(x + w, y + hh / 2); g.lineTo(x + w - d, y + hh); g.lineTo(x + d, y + hh); g.lineTo(x, y + hh / 2); g.closePath(); }
    else if (prst === "chevron" || prst === "homePlate"){ const d = hh / 2; g.moveTo(x, y); g.lineTo(x + w - d, y); g.lineTo(x + w, y + hh / 2); g.lineTo(x + w - d, y + hh); g.lineTo(x, y + hh); if (prst === "chevron") g.lineTo(x + d, y + hh / 2); g.closePath(); }
    else g.rect(x, y, w, hh);
  };
}
function styleColor(ctx, sp, refName){ const r = path(sp, "style", refName); return r && +r.getAttribute("idx") > 0 ? colorOf(ctx, r) : null; }

async function drawShape(ctx, sp, level, T){
  const ph = phOf(sp);
  const lph = ph && level === "slide" ? findPh(ctx.layout, ph) : null;
  const mph = ph ? findPh(ctx.master, ph) || (lph ? findPh(ctx.master, phOf(lph)) : null) : null;
  const xf = xfrmOf(sp) || xfrmOf(lph) || xfrmOf(mph);
  if (!xf) return;
  const b = box(ctx, xf, T), spPr = path(sp, "spPr"), geom = path(spPr, "prstGeom");
  const prst = geom ? geom.getAttribute("prst") : "rect";
  const shp = shapePathFn(ctx, prst, b, geom);
  await withXf(ctx, b, xf, async () => {
    // 채우기
    if (spPr && !(await fillRect(ctx, spPr, b.x, b.y, b.w, b.h, level, null, shp))){
      const sc = styleColor(ctx, sp, "fillRef"); if (sc && !/Connector|line/.test(prst)){ ctx.g.fillStyle = sc; shp(); ctx.g.fill(); }
    }
    // 테두리
    const ln = path(spPr, "ln");
    let lc = null, lw = 0;
    if (ln && !path(ln, "noFill")){ lc = colorOf(ctx, path(ln, "solidFill")) || styleColor(ctx, sp, "lnRef"); lw = (+ln.getAttribute("w") || 12700) * ctx.k; }
    else if (!ln){ lc = styleColor(ctx, sp, "lnRef"); lw = 12700 * ctx.k; }
    if (lc && lw){ ctx.g.strokeStyle = lc; ctx.g.lineWidth = Math.max(1, lw); shp(); ctx.g.stroke(); }
  });
  const tx = path(sp, "txBody");
  if (tx) drawText(ctx, tx, b, xf, { sp, ph, lph, mph });
}

async function drawPic(ctx, pic, level, T){
  const xf = xfrmOf(pic); if (!xf) return;
  const b = box(ctx, xf, T), blip = path(pic, "blipFill", "blip"), id = blip && blip.getAttributeNS(NS_R, "embed");
  const rels = level === "master" ? ctx.rels.master : level === "layout" ? ctx.rels.layout : ctx.rels.slide;
  const img = id && rels[id] ? await ctx.pptx.image(rels[id]) : null;
  if (!img) return;
  const src = path(pic, "blipFill", "srcRect");
  const l = src ? +(src.getAttribute("l") || 0) / 100000 : 0, t = src ? +(src.getAttribute("t") || 0) / 100000 : 0;
  const r = src ? +(src.getAttribute("r") || 0) / 100000 : 0, bt = src ? +(src.getAttribute("b") || 0) / 100000 : 0;
  const geom = path(pic, "spPr", "prstGeom"), shp = shapePathFn(ctx, geom ? geom.getAttribute("prst") : "rect", b, geom);
  withXf(ctx, b, xf, () => {
    ctx.g.save(); shp(); ctx.g.clip();
    ctx.g.drawImage(img, img.width * l, img.height * t, img.width * (1 - l - r), img.height * (1 - t - bt), b.x, b.y, b.w, b.h);
    ctx.g.restore();
  });
}

async function drawFrame(ctx, fr, level, T){
  const xf = xfrmOf(fr); if (!xf) return;
  const b = box(ctx, xf, T), tbl = fr.getElementsByTagNameNS(NS_A, "tbl")[0];
  const { g } = ctx;
  if (!tbl){ // 차트·스마트아트: 자리만 표시
    g.save(); g.strokeStyle = "#c9ccd8"; g.setLineDash([6, 4]); g.strokeRect(b.x, b.y, b.w, b.h); g.fillStyle = "#9aa0b4"; g.font = `${Math.max(12, b.h * .06)}px ${FONT_KO}`; g.textAlign = "center"; g.fillText("(차트·도형 묶음은 그림으로 옮기지 못했어요)", b.x + b.w / 2, b.y + b.h / 2); g.restore();
    return;
  }
  const cols = kids(path(tbl, "tblGrid"), NS_A, "gridCol").map(c => +c.getAttribute("w") * ctx.k * T.sx);
  let y = b.y;
  const rows = kids(tbl, NS_A, "tr");
  rows.forEach((tr, ri) => {
    const fsz = Math.max(...[...tr.getElementsByTagNameNS(NS_A, "rPr")].map(r => +(r.getAttribute("sz") || 1800)), 1800) / 100;
    const rh = Math.max(+tr.getAttribute("h") * ctx.k * T.sy, fsz * ctx.ptPx * 1.25 + 45720 * 2 * ctx.k);
    let x = b.x;
    kids(tr, NS_A, "tc").forEach((tc, ci) => {
      const span = +(tc.getAttribute("gridSpan") || 1), w = cols.slice(ci, ci + span).reduce((s, v) => s + v, 0) || cols[ci] || 50;
      if (tc.getAttribute("hMerge") === "1" || tc.getAttribute("vMerge") === "1"){ x += cols[ci] || 0; return; }
      const tcPr = path(tc, "tcPr");
      const fill = tcPr && colorOf(ctx, path(tcPr, "solidFill"));
      g.fillStyle = fill || (ri === 0 ? "#4472c4" : ri % 2 ? "#e9ebf5" : "#cfd5ea"); g.fillRect(x, y, w, rh);
      g.strokeStyle = "#ffffff"; g.lineWidth = 1.5; g.strokeRect(x, y, w, rh);
      const t = path(tc, "txBody");
      if (t) drawText(ctx, t, { x, y, w, h: rh }, { rot: 0 }, { cell: true, header: ri === 0 && !fill });
      x += w;
    });
    y += rh;
  });
}

/* 글자 그리기: 자동 줄바꿈(한글은 글자 단위), 정렬, 글머리표, 세로 정렬 */
function lvlStyle(ctx, info, lvl){
  // 기본값: 마스터 txStyles → 마스터/레이아웃 자리표시자 lstStyle → 도형 lstStyle
  const out = {};
  const take = el => {
    if (!el) return;
    const p = kid(el, NS_A, `lvl${lvl + 1}pPr`); if (!p) return;
    if (p.getAttribute("algn")) out.algn = p.getAttribute("algn");
    if (p.getAttribute("marL")) out.marL = +p.getAttribute("marL");
    if (p.getAttribute("indent")) out.indent = +p.getAttribute("indent");
    const d = kid(p, NS_A, "defRPr");
    if (d){ if (d.getAttribute("sz")) out.sz = +d.getAttribute("sz"); if (d.getAttribute("b")) out.b = d.getAttribute("b") === "1"; const c = colorOf(ctx, path(d, "solidFill")); if (c) out.color = c; }
    if (kid(p, NS_A, "buNone")) out.bu = null; const bc = kid(p, NS_A, "buChar"); if (bc) out.bu = bc.getAttribute("char");
    if (kid(p, NS_A, "buAutoNum")) out.bu = "#";
    const ls = path(p, "lnSpc", "spcPct"); if (ls) out.lnSpc = +ls.getAttribute("val") / 100000;
  };
  if (info.cell){ out.sz = 1400; out.color = info.header ? "#ffffff" : "#000000"; out.b = info.header; }
  else {
    const t = info.ph ? info.ph.type : null;
    const ts = ctx.master && path(ctx.master.documentElement, "txStyles");
    const which = !t ? "otherStyle" : (t === "title" || t === "ctrTitle") ? "titleStyle" : (t === "body" || t === "subTitle" || t === "obj") ? "bodyStyle" : "otherStyle";
    take(ts && path(ts, which));
    if (!t){ const def = ctx.pptx.xml["ppt/presentation.xml"] && path(ctx.pptx.xml["ppt/presentation.xml"].documentElement, "defaultTextStyle"); take(def); out.bu = null; }
    take(info.mph && path(info.mph, "txBody", "lstStyle"));
    take(info.lph && path(info.lph, "txBody", "lstStyle"));
    if (t === "subTitle" || t === "ctrTitle"){ if (!("algn" in out)) out.algn = "ctr"; out.bu = null; }
  }
  take(info.sp && path(info.sp, "txBody", "lstStyle"));
  if (info.sp && !out.color){ const fr = path(info.sp, "style", "fontRef"); const c = fr && colorOf(ctx, fr); if (c) out.color = c; }
  return out;
}
function drawText(ctx, tx, b, xf, info){
  const { g } = ctx;
  const bp = path(tx, "bodyPr") || { getAttribute: () => null };
  const lph = info.lph && path(info.lph, "txBody", "bodyPr"), mph = info.mph && path(info.mph, "txBody", "bodyPr");
  const attr = n => bp.getAttribute(n) ?? lph?.getAttribute(n) ?? mph?.getAttribute(n);
  const ins = (n, d) => (attr(n) != null ? +attr(n) : d) * ctx.k;
  const L = ins("lIns", 91440), R = ins("rIns", 91440), Tp = ins("tIns", 45720), B = ins("bIns", 45720);
  const anchor = attr("anchor") || (info.ph && /title/i.test(info.ph.type) ? "ctr" : "t");
  const wrapNone = attr("wrap") === "none";
  const auto = path(tx, "bodyPr", "normAutofit"), fontScale = auto && auto.getAttribute("fontScale") ? +auto.getAttribute("fontScale") / 100000 : 1;
  const lnRed = auto && auto.getAttribute("lnSpcReduction") ? +auto.getAttribute("lnSpcReduction") / 100000 : 0;
  const maxW = Math.max(10, b.w - L - R);
  const lines = []; let num = 0;
  for (const p of kids(tx, NS_A, "p")){
    const pPr = kid(p, NS_A, "pPr"), lvl = pPr ? +(pPr.getAttribute("lvl") || 0) : 0;
    const st = lvlStyle(ctx, info, lvl);
    const algn = (pPr && pPr.getAttribute("algn")) || st.algn || "l";
    const marL = ((pPr && pPr.getAttribute("marL") != null) ? +pPr.getAttribute("marL") : st.marL || 0) * ctx.k;
    const indent = ((pPr && pPr.getAttribute("indent") != null) ? +pPr.getAttribute("indent") : st.indent || 0) * ctx.k;
    let bu = st.bu;
    if (pPr){ if (kid(pPr, NS_A, "buNone")) bu = null; const bc = kid(pPr, NS_A, "buChar"); if (bc) bu = bc.getAttribute("char"); if (kid(pPr, NS_A, "buAutoNum")) bu = "#"; }
    const lnPct = (pPr && path(pPr, "lnSpc", "spcPct")) ? +path(pPr, "lnSpc", "spcPct").getAttribute("val") / 100000 : (st.lnSpc || 1);
    // 글자 조각(run)들
    const runs = [];
    for (const r of p.children){
      if (r.localName === "r" || r.localName === "fld"){
        const rp = kid(r, NS_A, "rPr"), t = kid(r, NS_A, "t");
        const sz = ((rp && rp.getAttribute("sz")) ? +rp.getAttribute("sz") : st.sz || 1800) / 100 * fontScale;
        const bold = rp && rp.getAttribute("b") != null ? rp.getAttribute("b") === "1" : !!st.b;
        const ital = rp && rp.getAttribute("i") === "1";
        const col = (rp && colorOf(ctx, path(rp, "solidFill"))) || st.color || "#" + schemeColor(ctx, "tx1");
        runs.push({ text: t ? t.textContent : "", sz, bold, ital, col, u: rp && rp.getAttribute("u") && rp.getAttribute("u") !== "none" });
      } else if (r.localName === "br") runs.push({ br: true });
    }
    const endSz = ((kid(p, NS_A, "endParaRPr")?.getAttribute("sz")) ? +kid(p, NS_A, "endParaRPr").getAttribute("sz") : st.sz || 1800) / 100 * fontScale;
    const hasText = runs.some(r => r.text && r.text.trim());
    if (bu === "#" && hasText) num++; else if (!hasText) {} else num = 0;
    const bullet = hasText && bu ? (bu === "#" ? num + "." : bu) : null;
    // 줄 나누기
    const toks = [];
    for (const r of runs){
      if (r.br){ toks.push({ br: true }); continue; }
      for (const piece of r.text.match(/[ᄀ-ᇿ　-鿿가-힯豈-﫿＀-￯]|\s+|[^\sᄀ-ᇿ　-鿿가-힯豈-﫿＀-￯]+/g) || []) toks.push({ ...r, text: piece });
    }
    const fontOf = t => `${t.ital ? "italic " : ""}${t.bold ? "700" : "400"} ${t.sz * ctx.ptPx}px ${FONT_KO}`;
    let cur = [], curW = 0, first = true;
    const firstX = bullet ? Math.max(marL, marL + indent + endSz * ctx.ptPx * .9) : marL + indent;
    const avail = () => maxW - (first ? firstX : marL);
    const push = () => { const sz = Math.max(endSz, ...cur.map(t => t.sz)); lines.push({ toks: cur, w: curW, sz, algn, x0: first ? firstX : marL, bullet: first ? bullet : null, bulletX: marL + indent, lnPct: lnPct * (1 - lnRed), col: cur[0]?.col || st.color || "#000" }); cur = []; curW = 0; first = false; };
    for (const t of toks){
      if (t.br){ push(); continue; }
      g.font = fontOf(t); const w = g.measureText(t.text).width;
      if (!wrapNone && curW + w > avail() && cur.length && !/^\s+$/.test(t.text)){ while (cur.length && /^\s+$/.test(cur[cur.length - 1].text)){ curW -= cur[cur.length - 1].w; cur.pop(); } push(); }
      if (!cur.length && /^\s+$/.test(t.text) && !first) continue;
      cur.push({ ...t, w, font: fontOf(t) }); curW += w;
    }
    push();
  }
  const lineH = l => l.sz * ctx.ptPx * 1.2 * l.lnPct;
  const total = lines.reduce((s, l) => s + lineH(l), 0);
  let y = b.y + Tp;
  if (anchor === "ctr") y = b.y + (b.h - total) / 2; else if (anchor === "b") y = b.y + b.h - B - total;
  withXf(ctx, b, xf, () => {
    g.textBaseline = "alphabetic";
    for (const l of lines){
      const lh = lineH(l), base = y + lh * .78;
      let x = b.x + L + l.x0;
      const room = maxW - l.x0;
      if (l.algn === "ctr") x += (room - l.w) / 2; else if (l.algn === "r") x += room - l.w;
      if (l.bullet){ g.font = `400 ${l.sz * ctx.ptPx}px ${FONT_KO}`; g.fillStyle = l.col; g.fillText(l.bullet === "•" || l.bullet.length === 1 ? (l.bullet.match(/[ -ɏ -⯿가-힯]/) ? l.bullet : "•") : l.bullet, b.x + L + l.bulletX, base); }
      for (const t of l.toks){ g.font = t.font; g.fillStyle = t.col; g.fillText(t.text, x, base); if (t.u){ g.fillRect(x, base + 2, t.w, Math.max(1, t.sz * ctx.ptPx / 15)); } x += t.w; }
      y += lh;
    }
  });
}
DT.Pptx = Pptx;

DT.register({ id: "ppt2pdf", group: "to", order: 3, name: "파워포인트 → PDF 변환", desc: "PPTX 슬라이드를 PDF로", ...tileIcon("P", "#d24726"),
  long: "파워포인트(.pptx) 슬라이드를 한 장씩 그려서 PDF로 만들어요. 글자·도형·그림·표는 옮기고, 애니메이션·차트·특수 효과는 빠지거나 다르게 보일 수 있어요. (예전 .ppt는 파워포인트에서 .pptx로 저장해 주세요)",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let pp = null, file = null;
    const prevGrid = h("div", { class: "pgrid hidden" });
    const drop = DT.dropZone({ accept: ".pptx", multiple: false, hint: "파워포인트 파일(.pptx) 1개", onFiles: fs => DT.guard(st, async () => {
      const f = fs[0], ext = DT.extOf(f.name);
      if (ext === "ppt") throw new Error("예전 형식(.ppt)은 바로 열 수 없어요. 파워포인트에서 '다른 이름으로 저장 → .pptx'로 바꿔 주세요.");
      if (ext !== "pptx") throw new Error("파워포인트(.pptx) 파일만 올릴 수 있어요.");
      file = f; st.busy("슬라이드를 읽는 중…");
      pp = await Pptx.open(await f.arrayBuffer());
      drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${f.name} (${pp.slides.length}장) — 다른 파일로 바꾸려면 누르세요`;
      prevGrid.innerHTML = ""; prevGrid.classList.remove("hidden");
      for (let i = 0; i < pp.slides.length; i++){
        const c = await pp.render(i, 320);
        const card = h("div", { class: "pcard", style: { cursor: "default" } }, h("div", { class: "pthumb" }, c), h("span", { class: "pnum" }, i + 1));
        const kk = 140 / Math.max(c.width, c.height); Object.assign(c.style, { width: c.width * kk + "px", height: c.height * kk + "px", transform: "translate(-50%,-50%)" });
        prevGrid.append(card); prog.set(i + 1, pp.slides.length); await DT.tick();
      }
      prog.done(); go.disabled = false; st.set("미리보기를 확인하고 'PDF로 저장'을 누르세요.");
    }) });
    const go = DT.button("PDF로 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big"); go.disabled = true;
    go.onclick = () => DT.guard(st, async () => {
      await DT.need("pdflib");
      const pdf = await PDFLib.PDFDocument.create(), Wpt = pp.cx / 12700, Hpt = pp.cy / 12700;
      for (let i = 0; i < pp.slides.length; i++){
        st.busy(`${i + 1}/${pp.slides.length}장 그리는 중…`);
        const c = await pp.render(i, 1920);
        await DT.addCanvasPage(pdf, c, Wpt, Hpt, { quality: .9 });
        prog.set(i + 1, pp.slides.length); await DT.tick();
      }
      prog.done();
      DT.save(await pdf.save(), DT.baseName(file.name) + ".pdf");
      st.ok(`슬라이드 ${pp.slides.length}장을 PDF로 저장했어요.`);
    });
    root.append(drop, h("div", { class: "row" }, go), prog, st, prevGrid);
  } });

/* ------------------------------------------------------------------ */
function sheetHtml(ws, { grid = true } = {}){
  const X = XLSX.utils, ref = ws["!ref"]; if (!ref) return "<p>(빈 시트)</p>";
  const R = X.decode_range(ref);
  // 실제로 값이 있는 끝까지만
  let maxR = R.s.r, maxC = R.s.c;
  for (const k in ws){ if (k[0] === "!") continue; const a = X.decode_cell(k); const v = ws[k]; if (v && v.v != null && v.v !== ""){ maxR = Math.max(maxR, a.r); maxC = Math.max(maxC, a.c); } }
  for (const m of ws["!merges"] || []){ maxR = Math.max(maxR, m.e.r); maxC = Math.max(maxC, m.e.c); }
  const merges = {}, skip = new Set();
  for (const m of ws["!merges"] || []){ merges[m.s.r + ":" + m.s.c] = m; for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) skip.add(r + ":" + c); }
  const cols = ws["!cols"] || [], rows = ws["!rows"] || [];
  let html = `<table class="xl${grid ? " grid" : ""}"><colgroup>`;
  for (let c = R.s.c; c <= maxC; c++){ const ci = cols[c] || {}; const w = ci.hidden ? 0 : ci.wpx || (ci.wch ? ci.wch * 7 + 5 : ci.width ? ci.width * 7 : 72); html += `<col style="width:${w}px">`; }
  html += "</colgroup>";
  for (let r = R.s.r; r <= maxR; r++){
    const ri = rows[r] || {}; if (ri.hidden) continue;
    html += `<tr style="height:${ri.hpx || (ri.hpt ? ri.hpt * 4 / 3 : 20)}px">`;
    for (let c = R.s.c; c <= maxC; c++){
      if (skip.has(r + ":" + c)) continue;
      const cell = ws[X.encode_cell({ r, c })], m = merges[r + ":" + c];
      const span = m ? ` rowspan="${m.e.r - m.s.r + 1}" colspan="${m.e.c - m.s.c + 1}"` : "";
      const txt = cell ? (cell.w != null ? cell.w : cell.v != null ? String(cell.v) : "") : "";
      const num = cell && (cell.t === "n" || cell.t === "d");
      let style = num ? "text-align:right;" : "";
      const s = cell && cell.s;
      if (s){
        if (s.fgColor && s.fgColor.rgb && s.patternType === "solid") style += `background:#${s.fgColor.rgb.slice(-6)};`;
        if (s.bold || (s.font && s.font.bold)) style += "font-weight:700;";
        if (s.alignment && s.alignment.horizontal) style += `text-align:${{ center: "center", centerContinuous: "center", right: "right", left: "left" }[s.alignment.horizontal] || "left"};`;
      }
      html += `<td${span} style="${style}">${esc(txt).replace(/\n/g, "<br>")}</td>`;
    }
    html += "</tr>";
  }
  return html + "</table>";
}
const XL_CSS = `table.xl{border-collapse:collapse;table-layout:fixed;font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:11px;color:#000}table.xl td{padding:2px 4px;overflow:hidden;white-space:pre-wrap;word-break:break-all;vertical-align:middle;line-height:1.3}table.xl.grid td{border:1px solid #bfbfbf}.xl-title{font:700 13px 'Malgun Gothic',sans-serif;margin:0 0 8px}`;

DT.register({ id: "excel2pdf", group: "to", order: 4, name: "엑셀 → PDF 변환", desc: "XLSX·XLS·CSV 표를 PDF로", ...tileIcon("X", "#217346"),
  long: "엑셀 표(.xlsx, .xls, .csv)를 PDF로 바꿔요. 시트를 골라서, 표가 넓으면 가로 방향·폭 맞춤으로 한 장에 들어가게 할 수 있어요. (색·테두리 서식은 일부만 옮겨져요)",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let wb = null, file = null, orient = "auto", fitW = true, grid = true;
    const sheetsBox = h("div", { class: "row" });
    const prev = h("div", { class: "stage hidden", style: { maxHeight: "460px", justifyContent: "flex-start" } });
    const drop = DT.dropZone({ accept: ".xlsx,.xls,.csv,.xlsm,.ods", multiple: false, hint: "엑셀 파일(.xlsx .xls .csv) 1개", onFiles: fs => DT.guard(st, async () => {
      const f = fs[0]; if (!["xlsx", "xls", "csv", "xlsm", "ods"].includes(DT.extOf(f.name))) throw new Error("엑셀 파일(.xlsx .xls .csv)만 올릴 수 있어요.");
      await DT.need("xlsx"); file = f; st.busy("표를 읽는 중…");
      wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellStyles: true, cellDates: true, codepage: 949 });
      drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${f.name} — 다른 파일로 바꾸려면 누르세요`;
      sheetsBox.innerHTML = ""; sheetsBox.append(h("span", { class: "fl", style: { fontWeight: 700, fontSize: "12.5px", color: "var(--sub)" } }, "시트:"));
      wb.SheetNames.forEach((n, i) => { const cb = h("input", { type: "checkbox", checked: true, "data-i": i }); cb.onchange = preview; sheetsBox.append(h("label", { class: "check" }, cb, n)); });
      preview(); go.disabled = false; st.set("");
    }) });
    function chosen(){ return [...sheetsBox.querySelectorAll("input")].filter(c => c.checked).map(c => wb.SheetNames[+c.dataset.i]); }
    function preview(){
      prev.innerHTML = `<style>${XL_CSS}</style>`;
      for (const n of chosen().slice(0, 3)){ prev.insertAdjacentHTML("beforeend", `<div style="background:#fff;padding:16px;margin-right:16px;line-height:normal"><p class="xl-title">${esc(n)}</p>${sheetHtml(wb.Sheets[n], { grid })}</div>`); }
      prev.classList.remove("hidden");
    }
    const go = DT.button("PDF로 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big"); go.disabled = true;
    go.onclick = () => DT.guard(st, async () => {
      const names = chosen(); if (!names.length) throw new Error("저장할 시트를 골라 주세요.");
      await DT.need("pdflib", "html2canvas");
      const pdf = await PDFLib.PDFDocument.create(); let pages = 0;
      for (const n of names){
        st.busy(`'${esc(n)}' 시트 그리는 중…`);
        const holder = stageBox(4000);
        holder.innerHTML = `<style>${XL_CSS}</style><div class="sheet" style="display:inline-block;padding:0;background:#fff"><p class="xl-title">${esc(n)}</p>${sheetHtml(wb.Sheets[n], { grid })}</div>`;
        await DT.tick();
        const node = holder.querySelector(".sheet"), tw = node.scrollWidth;
        let [W, H] = PAGE.a4; const land = orient === "land" || (orient === "auto" && tw > 760); if (land) [W, H] = [H, W];
        const margin = 28;
        // 폭 맞춤: 표 폭을 (페이지 폭 - 여백)에 맞춰 줄이기
        const contentPx = fitW ? tw : Math.max(tw, (W - 2 * margin) * 4 / 3);
        const wrapW = contentPx / ((W - 2 * margin) / W);
        holder.style.width = wrapW + "px"; node.style.padding = `${contentPx / (W - 2 * margin) * margin}px`; node.style.width = wrapW + "px"; node.style.boxSizing = "border-box";
        await DT.tick();
        pages += await domToPdf(pdf, node, { pageWpt: W, pageHpt: H, marginPx: contentPx / (W - 2 * margin) * margin, firstTopKeep: true, scale: Math.min(2, 3000 / wrapW * 1.2), onProg: prog.set });
        holder.remove();
      }
      prog.done();
      DT.save(await pdf.save(), DT.baseName(file.name) + ".pdf");
      st.ok(`시트 ${names.length}개를 ${pages}쪽 PDF로 저장했어요.`);
    });
    root.append(drop, sheetsBox,
      h("div", { class: "opts" },
        DT.field("방향", DT.seg([["auto", "자동"], ["port", "세로"], ["land", "가로"]], orient, v => orient = v)),
        DT.field("크기", DT.seg([["fit", "표 폭을 한 장에 맞추기"], ["real", "실제 크기"]], "fit", v => fitW = v === "fit")),
        h("label", { class: "check" }, Object.assign(h("input", { type: "checkbox", checked: true }), { onchange: e => { grid = e.target.checked; if (wb) preview(); } }), "칸 테두리 그리기"),
        go), prog, st, prev);
  } });

/* ------------------------------------------------------------------ */
DT.register({ id: "html2pdf", group: "to", order: 5, name: "HTML → PDF 변환", desc: "웹 문서(HTML)를 PDF로", ...tileIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>', "#e8a400"),
  long: "HTML 파일이나 HTML 코드를 붙여 넣어 PDF로 만들어요. (보안상 다른 웹사이트 주소는 브라우저에서 바로 가져올 수 없어요 — 그 페이지에서 <b>Ctrl+P → PDF로 저장</b>을 쓰세요)",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let width = 900;
    const code = h("textarea", { class: "textout", placeholder: "<h1>제목</h1><p>여기에 HTML 코드를 붙여 넣거나, 위에서 .html 파일을 올리세요.</p>" });
    const drop = DT.dropZone({ accept: ".html,.htm,.txt", multiple: false, hint: "HTML 파일 1개 (또는 아래에 코드 붙여넣기)", onFiles: async fs => { code.value = await fs[0].text(); name = DT.baseName(fs[0].name); drop.classList.add("small"); show(); } });
    let name = "웹문서";
    const frame = h("iframe", { sandbox: "allow-same-origin", style: { width: "100%", height: "420px", border: "1px solid var(--line)", borderRadius: "12px", background: "#fff" } });
    const show = () => { frame.srcdoc = code.value || "<p style='color:#999;font-family:sans-serif'>미리보기</p>"; };
    code.addEventListener("input", () => { clearTimeout(code._t); code._t = setTimeout(show, 400); });
    const go = DT.button("PDF로 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(st, async () => {
      if (!code.value.trim()) throw new Error("HTML 파일을 올리거나 코드를 붙여 넣어 주세요.");
      await DT.need("pdflib", "html2canvas"); st.busy("그리는 중…");
      const f2 = h("iframe", { sandbox: "allow-same-origin", style: { position: "fixed", left: "-20000px", top: "0", width: width + "px", height: "1200px", border: "0" } });
      document.body.append(f2); window.__dtCleanup.push(() => f2.remove());
      await new Promise(r => { f2.onload = r; f2.srcdoc = code.value; });
      await DT.sleep(300);
      const d = f2.contentDocument; d.body.style.margin = d.body.style.margin || "0"; d.documentElement.style.background = "#fff";
      f2.style.height = d.documentElement.scrollHeight + 50 + "px"; await DT.tick();
      const pdf = await PDFLib.PDFDocument.create(); const [W, H] = PAGE.a4;
      const wrap = d.body;
      wrap.style.padding = "36px"; wrap.style.boxSizing = "border-box"; wrap.style.width = width + "px";
      const n = await domToPdf(pdf, wrap, { pageWpt: W, pageHpt: H, marginPx: 36, firstTopKeep: true, onProg: prog.set });
      prog.done(); f2.remove();
      DT.save(await pdf.save(), name + ".pdf");
      st.ok(`${n}쪽 PDF로 저장했어요.`);
    });
    root.append(drop, DT.field("HTML 코드", code),
      h("div", { class: "opts" }, DT.field("화면 폭", DT.seg([["900", "보통(900px)"], ["1200", "넓게(1200px)"], ["600", "좁게(600px)"]], "900", v => width = +v)), go),
      prog, st, h("div", { class: "fl", style: { margin: "12px 0 6px", fontWeight: 700, color: "var(--sub)", fontSize: "13px" } }, "미리보기"), frame);
    show();
  } });
})();
