/* PDF에서 변환: PDF → JPG · 워드 · 파워포인트 · 엑셀 · PDF/A */
"use strict";
(() => {
const { h, esc } = DT;

function pdfToolShell(root, { hint, extra, onReady }){
  const st = DT.statusBox(), prog = DT.progress();
  const state = { pdf: null, st, prog };
  const rangeIn = h("input", { type: "text", placeholder: "비우면 전체 (예: 1-3, 5)", style: { width: "180px" } });
  const drop = DT.dropZone({ accept: ".pdf,application/pdf", multiple: false, hint: hint || "PDF 파일 1개", onFiles: fs => DT.guard(st, async () => {
    const [f] = DT.filterFiles(fs, ["pdf"], "PDF"); if (!f) return;
    st.busy("PDF 여는 중…"); state.pdf = await DT.openPdf(f); st.set("");
    drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${f.name} (${state.pdf.numPages}쪽) — 다른 파일로 바꾸려면 누르세요`;
    work.classList.remove("hidden"); onReady && onReady(state.pdf);
  }) });
  state.pages = () => rangeIn.value.trim() ? DT.parseRanges(rangeIn.value, state.pdf.numPages).flat() : [...Array(state.pdf.numPages).keys()];
  const work = h("div", { class: "hidden" }, h("div", { class: "opts" }, ...extra(state), DT.field("쪽 범위", rangeIn), state.go = Object.assign(DT.button("변환해서 저장", { primary: true, icon: DT.ICON.dl }), { className: "btn pri big" })), prog);
  root.append(drop, work, st);
  return state;
}

/* 한 쪽의 글자를 줄 단위로 모으기 */
async function pageLines(doc, pageNo){
  const page = await doc.getPage(pageNo), vp = page.getViewport({ scale: 1 });
  await page.getOperatorList();            // 글꼴 정보를 불러와서 굵은 글씨를 알아내려고
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items){
    if (!it.str || !it.str.trim()) continue;
    const [a, b, , d, e, f] = it.transform, size = Math.hypot(b, d) || Math.hypot(a, b) || 10;
    // 화면 좌표(왼쪽 위 원점)로
    const [x, y] = vp.convertToViewportPoint(e, f);
    let bold = false;
    try{ const fo = page.commonObjs.has(it.fontName) && page.commonObjs.get(it.fontName); bold = !!(fo && (/bold|black|heavy|semibold|-B\b|Bd/i.test(fo.name || "") || fo.bold)); }catch (er){}
    items.push({ str: it.str, x, y, w: it.width, size, bold });
  }
  items.sort((p, q) => Math.abs(p.y - q.y) < Math.min(p.size, q.size) * .5 ? p.x - q.x : p.y - q.y);
  const lines = [];
  for (const it of items){
    const L = lines[lines.length - 1];
    if (L && Math.abs(L.y - it.y) < Math.min(L.size, it.size) * .5){
      const gap = it.x - (L.x1);
      L.parts.push({ ...it, gap }); L.x1 = Math.max(L.x1, it.x + it.w); L.size = Math.max(L.size, it.size);
    } else lines.push({ y: it.y, x0: it.x, x1: it.x + it.w, size: it.size, parts: [{ ...it, gap: 0 }] });
  }
  for (const L of lines){
    L.text = L.parts.map((p, i) => (i && p.gap > p.size * .22 && !/\s$/.test(L.parts[i - 1].str) && !/^\s/.test(p.str) ? " " : "") + p.str).join("");
    L.bold = L.parts.filter(p => p.bold).reduce((s, p) => s + p.str.length, 0) > L.text.length / 2;
    L.multi = L.parts.some((p, i) => i && p.gap > Math.max(8, p.size * 1.5));   // 칸이 띄엄띄엄 → 표의 한 줄
  }
  page.cleanup();
  return { lines, W: vp.width, H: vp.height, page };
}

/* ------------------------------------------------------------------ */
DT.register({ id: "pdf2jpg", group: "from", order: 1, name: "PDF → JPG 변환", desc: "쪽마다 그림 파일로", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>', tile: "#e0a500",
  long: "PDF의 각 쪽을 JPG(또는 PNG) 그림으로 바꿔요. 여러 쪽이면 묶음(zip) 파일로 받아요.",
  mount(root){
    let dpi = 150, fmt = "jpg";
    const S = pdfToolShell(root, { extra: () => [
      DT.field("화질", DT.seg([["96", "화면용 96dpi"], ["150", "보통 150dpi"], ["300", "인쇄용 300dpi"]], "150", v => dpi = +v)),
      DT.field("형식", DT.seg([["jpg", "JPG"], ["png", "PNG(선명·큰 용량)"]], fmt, v => fmt = v))] });
    S.go.onclick = () => DT.guard(S.st, async () => {
      const pages = S.pages(), base = DT.baseName(S.pdf.name), out = [];
      for (let i = 0; i < pages.length; i++){
        S.st.busy(`${i + 1}/${pages.length}쪽 그림으로 바꾸는 중…`);
        const r = await DT.renderPage(S.pdf.doc, pages[i] + 1, { scale: dpi / 72, maxSide: 7000 });
        out.push({ name: `${base}_${String(pages[i] + 1).padStart(String(S.pdf.numPages).length, "0")}.${fmt}`, data: await DT.canvasBytes(r.canvas, fmt === "png" ? "image/png" : "image/jpeg", .9), mime: fmt === "png" ? "image/png" : "image/jpeg" });
        S.prog.set(i + 1, pages.length); await DT.tick();
      }
      S.prog.done();
      await DT.saveMany(out, base + "_그림.zip");
      S.st.ok(`${out.length}장의 그림으로 저장했어요${out.length > 1 ? " (zip 묶음)" : ""}.`);
    });
  } });

/* ------------------------------------------------------------------ */
/* 아주 작은 DOCX 만들기 */
const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
async function makeDocx(blocks, { pageWpt, pageHpt, marginPt = 50 }){
  await DT.need("jszip");
  const zip = new JSZip(), rels = [], tw = v => Math.round(v * 20);
  let imgN = 0, body = "";
  for (const b of blocks){
    if (b.type === "break"){ body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
    if (b.type === "table"){
      const total = pageWpt - 2 * marginPt, n = b.widths.length, sum = b.widths.reduce((a, c) => a + c, 0) || 1;
      const ws = b.widths.map(w => Math.max(30, w / sum * total));
      const bd = '<w:top w:val="single" w:sz="4" w:color="A0A0A0"/><w:left w:val="single" w:sz="4" w:color="A0A0A0"/><w:bottom w:val="single" w:sz="4" w:color="A0A0A0"/><w:right w:val="single" w:sz="4" w:color="A0A0A0"/><w:insideH w:val="single" w:sz="4" w:color="A0A0A0"/><w:insideV w:val="single" w:sz="4" w:color="A0A0A0"/>';
      body += `<w:tbl><w:tblPr><w:tblW w:w="${tw(ws.reduce((a, c) => a + c, 0))}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ws.map(w => `<w:gridCol w:w="${tw(w)}"/>`).join("")}</w:tblGrid>`;
      for (const r of b.rows){
        body += "<w:tr>";
        for (let c = 0; c < n; c++){ const v = r.cells[c] ?? "", sz = Math.max(8, Math.round(r.size * 2));
          body += `<w:tc><w:tcPr><w:tcW w:w="${tw(ws[c])}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr>${r.bold ? "<w:b/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(v)}</w:t></w:r></w:p></w:tc>`; }
        body += "</w:tr>";
      }
      body += '</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
      continue;
    }
    if (b.type === "image"){
      imgN++; const rid = "rIdImg" + imgN; zip.file(`word/media/image${imgN}.jpeg`, b.data);
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${imgN}.jpeg"/>`);
      const cx = Math.round(b.wPt * 12700), cy = Math.round(b.hPt * 12700);
      body += `<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imgN}" name="Page ${imgN}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgN}" name="image${imgN}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      continue;
    }
    const sz = Math.max(8, Math.round(b.size * 2)), jc = b.align ? `<w:jc w:val="${b.align}"/>` : "";
    const ind = b.indent > 2 ? `<w:ind w:left="${tw(b.indent)}"/>` : "";
    body += `<w:p><w:pPr><w:spacing w:before="${tw(b.before || 0)}" w:after="${tw(b.after ?? 4)}" w:line="${Math.round(240 * 1.15)}" w:lineRule="auto"/>${ind}${jc}</w:pPr><w:r><w:rPr>${b.bold ? "<w:b/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(b.text)}</w:t></w:r></w:p>`;
  }
  const m = tw(marginPt);
  body += `<w:sectPr><w:pgSz w:w="${tw(pageWpt)}" w:h="${tw(pageHpt)}"${pageWpt > pageHpt ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>`;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join("")}</Relationships>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="맑은 고딕" w:eastAsia="맑은 고딕" w:hAnsi="맑은 고딕" w:cs="맑은 고딕"/><w:sz w:val="20"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}
/* 줄 → 문단 */
function linesToParas(P){
  const { lines, W } = P, out = [];
  if (!lines.length) return out;
  const sizes = lines.map(l => l.size).sort((a, b) => a - b), body = sizes[Math.floor(sizes.length / 2)];
  const minX = Math.min(...lines.map(l => l.x0));
  let cur = null, tbl = null;
  for (let i = 0; i < lines.length; i++){
    const L = lines[i], prev = lines[i - 1];
    if (L.multi){
      if (!tbl){ tbl = { type: "table", lines: [] }; out.push(tbl); }
      tbl.lines.push(L); cur = null; continue;
    }
    tbl = null;
    const gap = prev ? L.y - prev.y : 0;
    const center = Math.abs((L.x0 + L.x1) / 2 - W / 2) < W * .04 && (L.x1 - L.x0) < W * .7;
    const sameStyle = cur && Math.abs(cur.size - L.size) < .8 && cur.bold === L.bold && !center && !cur.center;
    const cont = sameStyle && prev && gap < L.size * 1.75 && Math.abs(L.x0 - prev.x0) < L.size * 2.2 && prev.x1 > W * .55;
    if (cont){ cur.text += (/[가-힣]$/.test(cur.text) || /[A-Za-z0-9,.]$/.test(cur.text) ? " " : "") + L.text; }
    else {
      cur = { type: "p", text: L.text, size: L.size, bold: L.bold || L.size > body * 1.25, center, align: center ? "center" : null, indent: L.x0 - minX, before: prev && gap > L.size * 2.1 ? Math.min(18, gap - L.size * 1.4) : 0 };
      out.push(cur);
    }
  }
  for (const b of out) if (b.type === "table") Object.assign(b, tableOf(b.lines));
  return out;
}
/* 칸 시작 위치를 모아 열을 정하고, 각 줄을 칸으로 나누기 */
function tableOf(lines){
  const segsOf = L => { const segs = []; let c = null; L.parts.forEach((p, i) => { if (!c || p.gap > Math.max(8, p.size * 1.5)){ c = { x: p.x, x1: p.x + p.w, text: p.str }; segs.push(c); } else { c.text += (p.gap > p.size * .22 && !/\s$/.test(c.text) ? " " : "") + p.str; c.x1 = p.x + p.w; } }); return segs; };
  const all = lines.map(segsOf), xs = all.flat().map(s => s.x).sort((a, b) => a - b), anchors = [];
  for (const x of xs){ const a = anchors[anchors.length - 1]; if (a && x - a.last < 14){ a.last = x; } else anchors.push({ x, last: x }); }
  const cols = anchors.map(a => a.x);
  const rows = all.map((segs, ri) => { const cells = []; for (const s of segs){ let ci = 0; for (let k = 0; k < cols.length; k++) if (cols[k] <= s.x + 6) ci = k; cells[ci] = ((cells[ci] ? cells[ci] + " " : "") + s.text).trim(); } return { cells, size: lines[ri].size, bold: lines[ri].bold }; });
  const right = Math.max(...all.flat().map(s => s.x1));
  const widths = cols.map((x, i) => (cols[i + 1] ?? right + 10) - x);
  return { rows, widths };
}

DT.register({ id: "pdf2word", group: "from", order: 2, name: "PDF → 워드 변환", desc: "고칠 수 있는 DOCX로", tile: "#2b579a", icon: "W",
  long: "PDF의 글자를 읽어 <b>고칠 수 있는 워드(.docx)</b> 문서로 만들어요. 문단·글자 크기·굵기는 최대한 살리지만, 복잡한 표·단 나누기는 단순하게 바뀌어요. 스캔한 PDF는 먼저 'OCR PDF'를 쓰거나 '쪽 모양 그대로' 방식을 고르세요.",
  mount(root){
    let mode = "text";
    const S = pdfToolShell(root, { extra: () => [DT.field("방식", DT.seg([["text", "글자 고치기 (문단 재구성)"], ["image", "쪽 모양 그대로 (그림)"]], mode, v => mode = v))] });
    S.go.onclick = () => DT.guard(S.st, async () => {
      const pages = S.pages(), blocks = []; let W = 595.28, H = 841.89, chars = 0, imgPages = 0;
      for (let i = 0; i < pages.length; i++){
        S.st.busy(`${i + 1}/${pages.length}쪽 읽는 중…`);
        const P = await pageLines(S.pdf.doc, pages[i] + 1);
        if (i === 0){ W = P.W; H = P.H; }
        if (i) blocks.push({ type: "break" });
        const text = P.lines.map(l => l.text).join("");
        if (mode === "image" || text.replace(/\s/g, "").length < 15){
          const r = await DT.renderPage(S.pdf.doc, pages[i] + 1, { scale: 150 / 72 });
          const k = Math.min((W - 100) / r.widthPt, (H - 100) / r.heightPt);
          blocks.push({ type: "image", data: await DT.canvasBytes(r.canvas, "image/jpeg", .85), wPt: r.widthPt * k, hPt: r.heightPt * k });
          imgPages++;
        } else { blocks.push(...linesToParas(P)); chars += text.length; }
        S.prog.set(i + 1, pages.length); await DT.tick();
      }
      S.prog.done();
      const bytes = await makeDocx(blocks, { pageWpt: W, pageHpt: H, marginPt: mode === "image" ? 36 : 56 });
      DT.save(bytes, DT.baseName(S.pdf.name) + ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      S.st.ok(mode === "image" || !chars ? `${pages.length}쪽을 그림으로 넣은 워드 파일을 저장했어요.${mode !== "image" ? " (글자 정보가 없는 스캔 PDF예요 — 글자를 고치려면 'OCR PDF'를 먼저 해 보세요)" : ""}` : `글자 ${chars.toLocaleString()}자를 워드 문서로 옮겼어요.${imgPages ? ` (글자가 없는 ${imgPages}쪽은 그림으로 넣었어요 — 스캔 문서라면 OCR을 먼저 해 보세요)` : ""}`);
    });
  } });

/* ------------------------------------------------------------------ */
/* 글자가 있는 영역의 색: 글자 있는 그림과 글자를 뺀 그림의 차이로 찾기 */
function textColor(full, bare, x, y, w, hh){
  const g1 = full.getContext("2d"), g2 = bare.getContext("2d");
  x = Math.max(0, x | 0); y = Math.max(0, y | 0); w = Math.min(full.width - x, Math.ceil(w)); hh = Math.min(full.height - y, Math.ceil(hh));
  if (w < 1 || hh < 1) return "000000";
  const a = g1.getImageData(x, y, w, hh).data, b = g2.getImageData(x, y, w, hh).data;
  let r = 0, g = 0, bl = 0, n = 0;
  for (let i = 0; i < a.length; i += 4){ const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 120){ r += a[i]; g += a[i + 1]; bl += a[i + 2]; n++; } }
  if (!n) return "000000";
  return [r / n, g / n, bl / n].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

DT.register({ id: "pdf2ppt", group: "from", order: 3, name: "PDF → 파워포인트 변환", desc: "쪽마다 슬라이드로", tile: "#d24726", icon: "P",
  long: "PDF의 각 쪽을 파워포인트(.pptx) 슬라이드로 만들어요. <b>글자도 고치기</b>를 고르면 배경은 그림으로, 글자는 고칠 수 있는 글상자로 넣어요. 각 쪽의 글자는 슬라이드 노트에도 들어가요.",
  mount(root){
    let mode = "edit";
    const S = pdfToolShell(root, { extra: () => [DT.field("방식", DT.seg([["edit", "글자도 고치기"], ["image", "쪽 모양 그대로 (그림)"]], mode, v => mode = v))] });
    S.go.onclick = () => DT.guard(S.st, async () => {
      await DT.need("pptxgen");
      const pages = S.pages(), pptx = new PptxGenJS();
      const first = await S.pdf.doc.getPage(pages[0] + 1), vp0 = first.getViewport({ scale: 1 });
      const Win = vp0.width / 72, Hin = vp0.height / 72;
      pptx.defineLayout({ name: "PDF", width: Win, height: Hin }); pptx.layout = "PDF";
      let boxes = 0;
      for (let i = 0; i < pages.length; i++){
        S.st.busy(`${i + 1}/${pages.length}쪽 슬라이드로 만드는 중…`);
        const scale = 1600 / Math.max(vp0.width, vp0.height);
        const P = await pageLines(S.pdf.doc, pages[i] + 1);
        const kx = Win / P.W, ky = Hin / P.H;
        const slide = pptx.addSlide();
        const editable = mode === "edit" && P.lines.length;
        const bg = await DT.renderPage(S.pdf.doc, pages[i] + 1, { scale, noText: editable });
        const toB64 = c => c.toDataURL("image/jpeg", .88);
        slide.addImage({ data: toB64(bg.canvas), x: 0, y: 0, w: Win, h: Hin });
        if (editable){
          const full = await DT.renderPage(S.pdf.doc, pages[i] + 1, { scale });
          for (const L of P.lines){
            const top = L.y - L.size * .92, height = L.size * 1.25, s = bg.scale;
            const color = textColor(full.canvas, bg.canvas, L.x0 * s, top * s, (L.x1 - L.x0) * s, height * s);
            slide.addText(L.text, { x: L.x0 * kx, y: top * ky, w: Math.max(.3, (L.x1 - L.x0) * kx * 1.08 + .05), h: height * ky, fontSize: Math.max(4, L.size * .98), fontFace: "맑은 고딕", color, bold: L.bold, margin: 0, valign: "top", fit: "none", wrap: false });
            boxes++;
          }
        }
        const notes = P.lines.map(l => l.text).join("\n"); if (notes.trim()) slide.addNotes(notes);
        S.prog.set(i + 1, pages.length); await DT.tick();
      }
      S.prog.done();
      const blob = await pptx.write({ outputType: "blob" });
      DT.save(blob, DT.baseName(S.pdf.name) + ".pptx");
      S.st.ok(`슬라이드 ${pages.length}장을 만들었어요${boxes ? ` (고칠 수 있는 글상자 ${boxes}개)` : ""}.`);
    });
  } });

/* ------------------------------------------------------------------ */
function linesToRows(P){
  // 한 줄을 넓은 틈 기준으로 칸 조각으로 나눈 뒤, 쪽 전체에서 칸 시작 위치를 모아 열을 정한다
  const rows = P.lines.map(L => {
    const segs = []; let cur = null;
    L.parts.forEach((p, i) => {
      if (!cur || p.gap > Math.max(5, p.size * .9)){ cur = { x: p.x, text: p.str }; segs.push(cur); }
      else cur.text += (p.gap > p.size * .22 && !/\s$/.test(cur.text) ? " " : "") + p.str;
    });
    return segs.map(s => ({ ...s, text: s.text.trim() }));
  });
  const xs = rows.flat().map(s => s.x).sort((a, b) => a - b), anchors = [];
  for (const x of xs){ const a = anchors[anchors.length - 1]; if (a && x - a.max < 12){ a.max = x; a.sum += x; a.n++; } else anchors.push({ min: x, max: x, sum: x, n: 1 }); }
  const strong = anchors.filter(a => a.n >= 2), cols = (strong.length >= 2 ? strong : anchors).map(a => a.min);
  return rows.map(segs => {
    const r = [];
    for (const s of segs){
      let ci = 0; for (let k = 0; k < cols.length; k++) if (cols[k] <= s.x + 6) ci = k;
      while (r[ci] != null && ci < cols.length) ci++;
      r[ci] = toVal(s.text);
    }
    return r;
  });
}
function toVal(t){
  const s = t.replace(/,/g, "").trim();
  if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 16 && !/^0\d/.test(s)) return +s;
  if (/^-?\d+(\.\d+)?%$/.test(s)) return +s.slice(0, -1) / 100;
  return t;
}

DT.register({ id: "pdf2excel", group: "from", order: 4, name: "PDF → 엑셀 변환", desc: "표를 엑셀(XLSX)로", tile: "#217346", icon: "X",
  long: "PDF 안의 표·명단을 칸 위치에 맞춰 엑셀(.xlsx)로 옮겨요. 숫자는 계산할 수 있는 숫자로 바꿔요. 선이 없는 표도 글자 위치로 칸을 나눠요.",
  mount(root){
    let mode = "sheet";
    const S = pdfToolShell(root, { extra: () => [DT.field("시트", DT.seg([["sheet", "쪽마다 시트 따로"], ["one", "모두 한 시트에"]], mode, v => mode = v))] });
    S.go.onclick = () => DT.guard(S.st, async () => {
      await DT.need("xlsx");
      const pages = S.pages(), wb = XLSX.utils.book_new(), all = []; let cells = 0;
      for (let i = 0; i < pages.length; i++){
        S.st.busy(`${i + 1}/${pages.length}쪽 표 읽는 중…`);
        const rows = linesToRows(await pageLines(S.pdf.doc, pages[i] + 1));
        cells += rows.reduce((s, r) => s + r.filter(v => v != null).length, 0);
        if (mode === "one"){ if (i) all.push([]); all.push(...rows); }
        else addSheet(wb, rows, `${pages[i] + 1}쪽`);
        S.prog.set(i + 1, pages.length); await DT.tick();
      }
      if (mode === "one") addSheet(wb, all, "전체");
      S.prog.done();
      if (!cells) throw new Error("글자를 찾지 못했어요. 스캔한 PDF라면 'OCR PDF'를 먼저 해 주세요.");
      DT.save(XLSX.write(wb, { bookType: "xlsx", type: "array" }), DT.baseName(S.pdf.name) + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      S.st.ok(`칸 ${cells.toLocaleString()}개를 엑셀로 옮겼어요. 칸이 어긋난 곳은 엑셀에서 조금 손봐 주세요.`);
    });
    function addSheet(wb, rows, name){
      const ws = XLSX.utils.aoa_to_sheet(rows.map(r => Array.from(r, v => v ?? null)));
      const widths = []; rows.forEach(r => r.forEach((v, c) => { const len = v == null ? 0 : String(v).replace(/[가-힣]/g, "aa").length; widths[c] = Math.max(widths[c] || 6, Math.min(60, len + 2)); }));
      ws["!cols"] = widths.map(w => ({ wch: w || 6 }));
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    }
  } });

/* ------------------------------------------------------------------ */
/* sRGB ICC 색 프로필(v2, 감마 2.2) 만들기 — PDF/A 출력 조건에 필요 */
function makeSRGB(){
  const tags = [];
  const s15 = v => { const n = Math.round(v * 65536); return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const xyz = (x, y, z) => [..."XYZ ".split("").map(c => c.charCodeAt(0)), 0, 0, 0, 0, ...s15(x), ...s15(y), ...s15(z)];
  const desc = t => { const a = [..."desc"].map(c => c.charCodeAt(0)).concat([0, 0, 0, 0]); const n = t.length + 1; a.push(0, 0, 0, n, ...[...t].map(c => c.charCodeAt(0)), 0); a.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...new Array(67).fill(0)); return a; };
  const text = t => [..."text"].map(c => c.charCodeAt(0)).concat([0, 0, 0, 0], [...t].map(c => c.charCodeAt(0)), [0]);
  const curv = [..."curv"].map(c => c.charCodeAt(0)).concat([0, 0, 0, 0, 0, 0, 0, 1, 0x02, 0x33]);
  tags.push(["desc", desc("sRGB IEC61966-2.1")], ["cprt", text("No copyright, use freely")], ["wtpt", xyz(.9642, 1, .8249)],
    ["rXYZ", xyz(.4361, .2225, .0139)], ["gXYZ", xyz(.3851, .7169, .0971)], ["bXYZ", xyz(.1431, .0606, .7141)],
    ["rTRC", curv], ["gTRC", curv], ["bTRC", curv]);
  const pad4 = a => { while (a.length % 4) a.push(0); return a; };
  let off = 128 + 4 + tags.length * 12; const table = [], data = [];
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  for (const [sig, d] of tags){ table.push(...[...sig].map(c => c.charCodeAt(0)), ...u32(off), ...u32(d.length)); pad4(d); data.push(...d); off += d.length; }
  const size = 128 + 4 + table.length + data.length;
  const hdr = [...u32(size), 0, 0, 0, 0, 0x02, 0x10, 0, 0, ..."mntrRGB XYZ ".split("").map(c => c.charCodeAt(0)),
    0x07, 0xE6, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, ..."acsp".split("").map(c => c.charCodeAt(0)), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ...s15(.9642), ...s15(1), ...s15(.8249)];
  while (hdr.length < 128) hdr.push(0);
  return new Uint8Array([...hdr, ...u32(tags.length), ...table, ...data]);
}
DT.makeSRGB = makeSRGB;
const isoUtc = d => d.toISOString().replace(/\.\d{3}Z$/, "Z");

DT.register({ id: "pdf2pdfa", group: "from", order: 5, name: "PDF → PDF/A 변환", desc: "오래 보관하는 표준 형식", tile: "#3d5a99", icon: "/A",
  long: "공문서·기록물 보관용 표준인 <b>PDF/A-2b</b> 형식으로 바꿔요. 글꼴 문제 없이 오래 똑같이 보이도록 각 쪽을 고화질 그림으로 넣고, 색 프로필과 문서 정보를 함께 넣어요.",
  mount(root){
    let dpi = 200;
    const title = h("input", { type: "text", placeholder: "문서 제목(비우면 파일 이름)", style: { width: "220px" } });
    const S = pdfToolShell(root, { extra: () => [DT.field("화질", DT.seg([["150", "150dpi"], ["200", "200dpi"], ["300", "300dpi"]], "200", v => dpi = +v)), DT.field("문서 제목", title)] });
    root.append(h("div", { class: "note" }, "💡 각 쪽을 그림으로 넣기 때문에 글자 선택·검색은 되지 않아요. 기관 제출용이라면 공식 검증 프로그램(veraPDF 등)으로 한 번 확인하는 것을 권해요."));
    S.go.onclick = () => DT.guard(S.st, async () => {
      await DT.need("pdflib");
      const { PDFName, PDFString, PDFHexString } = PDFLib;
      const pages = S.pages(), doc = await PDFLib.PDFDocument.create({ updateMetadata: false });
      for (let i = 0; i < pages.length; i++){
        S.st.busy(`${i + 1}/${pages.length}쪽 변환 중…`);
        const r = await DT.renderPage(S.pdf.doc, pages[i] + 1, { scale: dpi / 72, maxSide: 6000 });
        await DT.addCanvasPage(doc, r.canvas, r.widthPt, r.heightPt, { quality: .88 });
        S.prog.set(i + 1, pages.length); await DT.tick();
      }
      S.prog.done();
      const now = new Date(); now.setMilliseconds(0);
      const t = title.value.trim() || DT.baseName(S.pdf.name), producer = "Ahwa MS Doc Tools (pdf-lib)", creator = "각종문서변환 - 아화중학교 과학";
      doc.setTitle(t); doc.setProducer(producer); doc.setCreator(creator); doc.setCreationDate(now); doc.setModificationDate(now);
      const ctx = doc.context;
      const icc = ctx.flateStream(makeSRGB(), { N: 3 });
      const oi = ctx.obj({ Type: "OutputIntent", S: "GTS_PDFA1", OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"), Info: PDFString.of("sRGB IEC61966-2.1"), RegistryName: PDFString.of("http://www.color.org"), DestOutputProfile: ctx.register(icc) });
      doc.catalog.set(PDFName.of("OutputIntents"), ctx.obj([ctx.register(oi)]));
      const xe = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xe(t)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreateDate>${isoUtc(now)}</xmp:CreateDate><xmp:ModifyDate>${isoUtc(now)}</xmp:ModifyDate><xmp:MetadataDate>${isoUtc(now)}</xmp:MetadataDate><xmp:CreatorTool>${xe(creator)}</xmp:CreatorTool></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${xe(producer)}</pdf:Producer></rdf:Description>
</rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
      const meta = ctx.stream(new TextEncoder().encode(xmp), { Type: "Metadata", Subtype: "XML" });
      doc.catalog.set(PDFName.of("Metadata"), ctx.register(meta));
      doc.catalog.set(PDFName.of("Lang"), PDFString.of("ko-KR"));
      const hex = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
      ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(hex), PDFHexString.of(hex)]);
      DT.save(await doc.save({ useObjectStreams: false }), DT.baseName(S.pdf.name) + "_PDFA.pdf");
      S.st.ok(`${pages.length}쪽을 PDF/A-2b 형식으로 저장했어요.`);
    });
  } });
})();
