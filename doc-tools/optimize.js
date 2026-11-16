/* PDF 최적화: 압축 · 복구 · OCR */
"use strict";
(() => {
const { h, esc } = DT;
const I = {
  compress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  repair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>',
  ocr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/></svg>',
};

function onePdfDrop(root, st, onPdf, hint){
  const drop = DT.dropZone({ accept: ".pdf,application/pdf", multiple: false, hint: hint || "PDF 파일 1개", onFiles: async fs => {
    const [f] = DT.filterFiles(fs, ["pdf"], "PDF"); if (!f) return;
    drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${f.name} (${DT.fmtSize(f.size)}) — 다른 파일로 바꾸려면 누르세요`;
    st.set(""); onPdf(f);
  } });
  root.append(drop);
  return drop;
}

/* ------------------------------------------------------------------ */
const LEVELS = {
  low: { name: "약하게 (화질 우선)", maxDim: 2400, q: .8, dpi: 150, rq: .78 },
  mid: { name: "권장", maxDim: 1700, q: .66, dpi: 120, rq: .65 },
  high: { name: "강하게 (용량 우선)", maxDim: 1150, q: .52, dpi: 90, rq: .5 },
};
async function compressSmart(bytes, L, onProg){
  await DT.need("pdflib");
  const { PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDocument } = PDFLib;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context, N = n => PDFName.of(n);
  const objs = ctx.enumerateIndirectObjects().filter(([, o]) => o instanceof PDFRawStream);
  let done = 0, changed = 0, saved = 0;
  for (const [ref, obj] of objs){
    done++;
    const d = obj.dict;
    if (d.get(N("Subtype")) !== N("Image")) continue;
    let filt = d.get(N("Filter"));
    if (filt instanceof PDFArray){ if (filt.size() !== 1) continue; filt = filt.get(0); }
    if (filt !== N("DCTDecode")) continue;
    if (d.get(N("Decode")) || d.get(N("ImageMask"))) continue;
    const cs = d.lookup(N("ColorSpace"));
    let ok = cs === N("DeviceRGB") || cs === N("DeviceGray");
    if (cs instanceof PDFArray && cs.get(0) === N("ICCBased")){ const n = cs.lookup(1)?.dict?.get(N("N")); ok = n && (n.asNumber() === 3 || n.asNumber() === 1); }
    if (!ok) continue;
    const src = obj.contents;
    let bmp;
    try{ bmp = await createImageBitmap(new Blob([src], { type: "image/jpeg" })); }catch (e){ continue; }
    const k = Math.min(1, L.maxDim / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
    const nb = await DT.canvasBytes(c, "image/jpeg", L.q);
    if (nb.length < src.length * .92){
      d.set(N("Width"), PDFNumber.of(c.width)); d.set(N("Height"), PDFNumber.of(c.height));
      d.set(N("ColorSpace"), N("DeviceRGB")); d.set(N("BitsPerComponent"), PDFNumber.of(8));
      d.set(N("Filter"), N("DCTDecode")); d.delete(N("DecodeParms")); d.set(N("Length"), PDFNumber.of(nb.length));
      ctx.assign(ref, PDFRawStream.of(d, nb));
      changed++; saved += src.length - nb.length;
    }
    if (done % 4 === 0){ onProg && onProg(done, objs.length); await DT.tick(); }
  }
  const out = await doc.save({ useObjectStreams: true });
  return { bytes: out, changed };
}
async function compressRaster(file, L, onProg){
  const p = await DT.openPdf(file); await DT.need("pdflib");
  const out = await PDFLib.PDFDocument.create();
  for (let i = 1; i <= p.numPages; i++){
    const r = await DT.renderPage(p.doc, i, { scale: L.dpi / 72 });
    await DT.addCanvasPage(out, r.canvas, r.widthPt, r.heightPt, { quality: L.rq });
    onProg && onProg(i, p.numPages); await DT.tick();
  }
  return { bytes: await out.save() };
}

DT.register({ id: "compress", group: "opt", order: 1, name: "PDF 압축", desc: "파일 용량 줄이기", icon: I.compress,
  long: "스캔 문서·사진이 많은 PDF의 용량을 줄여요. <b>글자 유지</b> 방식은 글자는 그대로 두고 사진만 줄이고, <b>최대 압축</b>은 페이지를 그림으로 바꿔 크게 줄여요(글자 선택이 안 돼요).",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let file = null, level = "mid", mode = "smart";
    onePdfDrop(root, st, f => { file = f; work.classList.remove("hidden"); });
    const go = DT.button("압축해서 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(st, async () => {
      const L = LEVELS[level]; st.busy("압축하는 중… (페이지가 많으면 시간이 걸려요)");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = mode === "smart" ? await compressSmart(bytes, L, prog.set) : await compressRaster(file, L, prog.set);
      prog.done();
      const before = file.size, after = r.bytes.length, pct = Math.round((1 - after / before) * 100);
      if (after >= before * .98){
        st.err(`더 줄이지 못했어요 (${DT.fmtSize(before)} → ${DT.fmtSize(after)}). ${mode === "smart" ? (r.changed ? "" : "줄일 수 있는 사진이 없는 PDF예요. ") + "'최대 압축'을 써 보세요." : "이미 잘 압축된 파일이에요."}`);
        return;
      }
      DT.save(r.bytes, DT.baseName(file.name) + "_압축.pdf");
      st.ok(`${DT.fmtSize(before)} → <b>${DT.fmtSize(after)}</b> (${pct}% 줄었어요)${mode === "smart" ? ` · 사진 ${r.changed}개를 줄였어요` : ""}`);
    });
    const work = h("div", { class: "hidden" },
      h("div", { class: "opts" },
        DT.field("방식", DT.seg([["smart", "글자 유지 (추천)"], ["raster", "최대 압축 (페이지를 그림으로)"]], mode, v => mode = v)),
        DT.field("압축 정도", DT.seg(Object.entries(LEVELS).map(([k, v]) => [k, v.name]), level, v => level = v)),
        go),
      prog);
    root.append(work, st);
  } });

/* 깨진 파일에서 JPEG 그림(FFD8 … FFD9) 찾아내기 */
function scavengeJpegs(bytes){
  const out = [], dec = new TextDecoder("latin1");
  const txt = dec.decode(bytes);
  const re = /\/DCTDecode[\s\S]{0,400}?stream\r?\n/g; let m;
  while ((m = re.exec(txt))){
    const start = m.index + m[0].length;
    if (bytes[start] !== 0xFF || bytes[start + 1] !== 0xD8) continue;
    const endIdx = txt.indexOf("endstream", start);
    let end = endIdx > 0 ? endIdx : bytes.length;
    // 끝 표시(FFD9) 바로 뒤까지
    let k = end - 1; while (k > start && !(bytes[k - 1] === 0xFF && bytes[k] === 0xD9)) k--;
    if (k > start + 100) out.push(bytes.slice(start, k + 1));
    else if (endIdx < 0 && end - start > 2000){ const cut = bytes.slice(start, end); out.push(new Uint8Array([...cut, 0xFF, 0xD9])); }
  }
  return out;
}

/* ------------------------------------------------------------------ */
DT.register({ id: "repair", group: "opt", order: 2, name: "PDF 복구", desc: "열리지 않는 PDF 살리기", icon: I.repair,
  long: "내려받다 끊기거나 구조가 깨져서 열리지 않는 PDF를 다시 읽어서, 살릴 수 있는 페이지를 새 PDF로 저장해요.",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress(), res = h("div", { class: "result" });
    onePdfDrop(root, st, f => DT.guard(st, async () => {
      res.innerHTML = ""; await DT.need("pdflib", "pdfjs");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const count = async b => { try{ const d = await pdfjsLib.getDocument({ data: b.slice(), isEvalSupported: false, stopAtErrors: false }).promise; const n = d.numPages; d.destroy(); return n; }catch (e){ return 0; } };
      st.busy("파일 구조를 다시 읽는 중…");
      let a = null, aPages = 0;
      try{
        const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
        if (doc.getPageCount()){ a = await doc.save(); aPages = await count(a); }
      }catch (e){ console.warn("pdf-lib 복구 실패", e); }
      st.busy("페이지를 하나씩 확인하는 중…");
      let pj = null, pjPages = 0;
      try{ pj = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false, stopAtErrors: false }).promise; pjPages = pj.numPages; }catch (e){ console.warn("pdf.js 복구 실패", e); }
      let out, method, pages;
      if (a && aPages >= pjPages){ out = a; method = "파일 구조(목차표)를 다시 만들어 저장했어요. 글자·화질은 원본 그대로예요."; pages = aPages; }
      else if (pj && pjPages){
        const doc = await PDFLib.PDFDocument.create(); let okN = 0;
        for (let i = 1; i <= pjPages; i++){
          try{ const r = await DT.renderPage(pj, i, { scale: 2 }); await DT.addCanvasPage(doc, r.canvas, r.widthPt, r.heightPt, { quality: .85 }); okN++; }
          catch (e){ console.warn("페이지 실패", i, e); }
          prog.set(i, pjPages); await DT.tick();
        }
        prog.done();
        if (!okN) throw new Error("살릴 수 있는 페이지가 없어요. 원본 파일을 다시 받아 보세요.");
        out = await doc.save(); pages = okN; method = `구조가 많이 깨져서, 읽을 수 있는 ${okN}/${pjPages}쪽을 그림으로 다시 그려 저장했어요(글자 선택은 안 돼요).`;
      } else {
        // 마지막 방법: 파일 안에 남아 있는 사진(JPEG) 조각을 직접 찾아 페이지로 만든다 (스캔 PDF에 효과적)
        st.busy("남아 있는 그림 조각을 찾는 중…");
        const jpgs = scavengeJpegs(bytes);
        if (!jpgs.length) throw new Error("PDF로 읽을 수 없고, 살릴 수 있는 그림도 없어요. 파일 끝부분이 많이 잘렸거나 PDF가 아닐 수 있어요.");
        const doc = await PDFLib.PDFDocument.create(); let okN = 0;
        for (const j of jpgs){
          try{ const img = await doc.embedJpg(j); const k = Math.min(1, 595.28 / img.width, 841.89 / img.height); const land = img.width > img.height; const W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, s = Math.min(W / img.width, H / img.height); doc.addPage([W, H]).drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s }); okN++; }catch (e){}
        }
        if (!okN) throw new Error("PDF로 읽을 수 없고, 살릴 수 있는 그림도 없어요.");
        out = await doc.save(); pages = okN; method = `페이지 정보가 사라져서, 파일 안에 남아 있던 그림 ${okN}장을 찾아 한 쪽씩 새로 만들었어요(글자 정보는 살리지 못했어요).`;
      }
      DT.save(out, DT.baseName(f.name) + "_복구.pdf");
      st.ok(`${pages}쪽을 복구했어요. ${method}`);
    }), "열리지 않거나 오류가 나는 PDF 파일 1개");
    root.append(prog, res, st);
  } });

/* ------------------------------------------------------------------ */
let tessWorker = null, tessLang = "", tessLog = null;
async function getWorker(lang, log){
  await DT.need("tesseract");
  tessLog = log;
  if (tessWorker && tessLang === lang) return tessWorker;
  if (tessWorker){ await tessWorker.terminate(); tessWorker = null; }
  const base = new URL("lib/tesseract/", location.href).href;
  tessWorker = await Tesseract.createWorker(lang.split("+"), 1, {
    workerPath: base + "worker.min.js", corePath: base, langPath: base + "lang", workerBlobURL: false, gzip: true,
    cacheMethod: "none", logger: m => tessLog && tessLog(m),
  });
  tessLang = lang;
  return tessWorker;
}
/* 글자 층(보이지 않는 글자)을 원래 페이지 위에 같은 위치로 겹치기 */
function overlayText(page, embedded, rot){
  const box = page.getCropBox(), Wc = box.width, Hc = box.height;
  const t = rot % 180 === 90, W = t ? Hc : Wc, H = t ? Wc : Hc;
  const pos = { 0: [0, 0], 90: [Wc, 0], 180: [Wc, Hc], 270: [0, Hc] }[rot];
  page.drawPage(embedded, { x: box.x + pos[0], y: box.y + pos[1], width: W, height: H, rotate: PDFLib.degrees(rot) });
}

DT.register({ id: "ocr", group: "opt", order: 3, name: "OCR PDF", desc: "스캔 문서에서 글자 찾기", icon: I.ocr,
  long: "스캔하거나 사진으로 찍은 PDF·그림에서 글자를 읽어(OCR), <b>글자 검색·복사가 되는 PDF</b>와 텍스트를 만들어요. 한국어·영어를 읽을 수 있어요. 처음 한 번은 글자 인식 자료(약 10MB)를 불러와요.",
  mount(root){
    const st = DT.statusBox(), prog = DT.progress();
    let file = null, lang = "kor+eng", outMode = "pdf";
    const text = h("textarea", { class: "textout hidden", readonly: true });
    const drop = DT.dropZone({ accept: ".pdf,application/pdf,image/*", multiple: false, hint: "스캔한 PDF 1개 또는 사진(JPG·PNG)", onFiles: fs => { file = fs[0]; drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${file.name} — 다른 파일로 바꾸려면 누르세요`; work.classList.remove("hidden"); } });
    const rangeIn = h("input", { type: "text", placeholder: "비우면 전체 (예: 1-3)", style: { width: "170px" } });
    const go = DT.button("글자 읽기 시작", { primary: true }); go.classList.add("big");
    const copyBtn = h("button", { class: "mini hidden", type: "button", onclick: () => { navigator.clipboard?.writeText(text.value); DT.toast("텍스트를 복사했어요"); } }, "📋 텍스트 복사");
    go.onclick = () => DT.guard(st, async () => {
      go.disabled = true;
      try{
        await DT.need("pdflib", "pdfjs");
        // 그림이면 먼저 1쪽짜리 PDF로
        let bytes;
        if (DT.extOf(file.name) === "pdf") bytes = new Uint8Array(await file.arrayBuffer());
        else {
          const c = await DT.imageToCanvas(file, 3000), d = await PDFLib.PDFDocument.create();
          await DT.addCanvasPage(d, c, c.width * 72 / 200, c.height * 72 / 200, { quality: .9 }); bytes = await d.save();
        }
        const pj = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
        const pages = rangeIn.value.trim() ? DT.parseRanges(rangeIn.value, pj.numPages).flat() : [...Array(pj.numPages).keys()];
        let cur = 0, chars = 0;
        st.busy("글자 인식 자료를 불러오는 중… (처음 한 번은 조금 걸려요)");
        const w = await getWorker(lang, m => { if (m.status === "recognizing text") prog.set(cur + m.progress, pages.length); else if (m.progress != null && /load|initiali/.test(m.status)) st.busy(`준비 중… ${Math.round(m.progress * 100)}%`); });
        const out = await DT.loadLib(bytes), txt = [];
        for (const i of pages){
          st.busy(`${cur + 1}/${pages.length}쪽 글자 읽는 중…`);
          const r = await DT.renderPage(pj, i + 1, { scale: 300 / 72, maxSide: 3300 });
          const dpi = Math.round(r.scale * 72);
          await w.setParameters({ user_defined_dpi: String(dpi) });
          const { data } = await w.recognize(r.canvas, { pdfTitle: "OCR", pdfTextOnly: true }, { pdf: outMode === "pdf", text: true });
          txt.push(`===== ${i + 1}쪽 =====\n` + (data.text || "").trim());
          chars += (data.text || "").replace(/\s/g, "").length;
          if (outMode === "pdf" && data.pdf){
            const layer = await PDFLib.PDFDocument.load(new Uint8Array(data.pdf));
            const [emb] = await out.embedPdf(layer, [0]);
            const page = out.getPage(i), rot = ((page.getRotation().angle % 360) + 360) % 360;
            overlayText(page, emb, rot);
          }
          cur++; prog.set(cur, pages.length); await DT.tick();
        }
        prog.done(); pj.destroy();
        text.value = txt.join("\n\n"); text.classList.remove("hidden"); copyBtn.classList.remove("hidden");
        const base = DT.baseName(file.name);
        if (outMode === "pdf") DT.save(await out.save(), base + "_OCR.pdf");
        else DT.save(new Blob(["﻿" + text.value], { type: "text/plain;charset=utf-8" }), base + "_OCR.txt");
        st.ok(`${pages.length}쪽에서 글자 ${chars.toLocaleString()}자를 읽었어요. ${outMode === "pdf" ? "저장된 PDF에서 글자를 검색(Ctrl+F)하거나 복사할 수 있어요." : ""} 아래에서 읽은 글자를 확인하세요.`);
        if (chars < 5) st.err("글자를 거의 찾지 못했어요. 사진이 흐리거나 기울어지지 않았는지, 언어 선택이 맞는지 확인해 주세요.");
      } finally { go.disabled = false; }
    });
    const work = h("div", { class: "hidden" },
      h("div", { class: "opts" },
        DT.field("문서 언어", DT.seg([["kor+eng", "한국어 + 영어"], ["kor", "한국어"], ["eng", "영어"]], lang, v => lang = v)),
        DT.field("만들 것", DT.seg([["pdf", "검색되는 PDF"], ["txt", "텍스트 파일(.txt)"]], outMode, v => outMode = v)),
        DT.field("쪽 범위", rangeIn), go),
      h("div", { class: "note" }, "💡 원본 페이지 모습은 그대로 두고, 그 위에 보이지 않는 글자 층을 겹쳐요. 손글씨나 흐린 사진은 잘 못 읽을 수 있어요."),
      prog);
    root.append(drop, work, st, copyBtn, text);
  } });
})();
