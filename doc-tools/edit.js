/* PDF 편집: 페이지 번호 · 워터마크 · 자르기 · PDF 편집 · PDF 양식 */
"use strict";
(() => {
const { h, esc } = DT;

/* 보이는 모습(회전 반영, 왼쪽 아래 원점) ↔ PDF 내부 좌표 */
function pageGeom(page){
  const b = page.getCropBox(), R = ((page.getRotation().angle % 360) + 360) % 360;
  const t = R % 180 === 90;
  return { x0: b.x, y0: b.y, W: b.width, H: b.height, R, VW: t ? b.height : b.width, VH: t ? b.width : b.height };
}
function toContent(g, vx, vy){
  const { W, H, R, x0, y0 } = g;
  const [u, v] = R === 90 ? [W - vy, vx] : R === 180 ? [W - vx, H - vy] : R === 270 ? [vy, H - vx] : [vx, vy];
  return { x: x0 + u, y: y0 + v };
}
/* 보이는 자리 (vx,vy) 에 θ도(반시계) 돌려서 그리기 위한 옵션 */
function placeOpts(g, vx, vy, theta = 0){ const p = toContent(g, vx, vy); return { x: p.x, y: p.y, rotate: PDFLib.degrees(theta + g.R) }; }
DT.pageGeom = pageGeom; DT.toContent = toContent; DT.placeOpts = placeOpts;

function onePdf(root, { onReady, hint } = {}){
  const st = DT.statusBox(), prog = DT.progress(), S = { pdf: null, st, prog };
  const drop = DT.dropZone({ accept: ".pdf,application/pdf", multiple: false, hint: hint || "PDF 파일 1개", onFiles: fs => DT.guard(st, async () => {
    const [f] = DT.filterFiles(fs, ["pdf"], "PDF"); if (!f) return;
    st.busy("PDF 여는 중…"); S.pdf = await DT.openPdf(f); st.set("");
    drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${f.name} (${S.pdf.numPages}쪽) — 다른 파일로 바꾸려면 누르세요`;
    S.work.classList.remove("hidden"); onReady && await onReady(S.pdf);
  }) });
  S.work = h("div", { class: "hidden" });
  root.append(drop, S.work, prog, st);
  return S;
}
/* 양식 칸 종류 (압축된 라이브러리라 클래스 이름 대신 instanceof 로) */
function kindOf(f){ const L = PDFLib; return f instanceof L.PDFTextField ? "PDFTextField" : f instanceof L.PDFCheckBox ? "PDFCheckBox" : f instanceof L.PDFRadioGroup ? "PDFRadioGroup" : f instanceof L.PDFDropdown ? "PDFDropdown" : f instanceof L.PDFOptionList ? "PDFOptionList" : null; }
const pagesOf = (txt, n) => txt.trim() ? DT.parseRanges(txt, n).flat() : [...Array(n).keys()];

/* ------------------------------------------------------------------ */
DT.register({ id: "pagenum", group: "edit", order: 2, name: "페이지 번호 넣기", desc: "쪽 번호 자동으로", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
  long: "모든 쪽(또는 고른 쪽)에 쪽 번호를 넣어요. 위치·모양·시작 번호를 고를 수 있어요.",
  mount(root){
    let pos = "bc", fmt = "n";
    const start = h("input", { type: "number", value: 1, min: 0 }), size = h("input", { type: "number", value: 11, min: 6, max: 40 });
    const margin = h("input", { type: "number", value: 24, min: 0, max: 100 }), range = h("input", { type: "text", placeholder: "비우면 전체 (예: 2-)", style: { width: "150px" } });
    const color = h("input", { type: "color", value: "#333333" }), skip1 = h("input", { type: "checkbox" });
    const S = onePdf(root);
    const posSeg = DT.seg([["tl", "↖ 왼쪽 위"], ["tc", "↑ 가운데 위"], ["tr", "↗ 오른쪽 위"], ["bl", "↙ 왼쪽 아래"], ["bc", "↓ 가운데 아래"], ["br", "↘ 오른쪽 아래"]], pos, v => pos = v);
    const fmtSeg = DT.seg([["n", "1"], ["nN", "1 / 10"], ["dash", "- 1 -"], ["p", "p. 1"], ["page", "Page 1 of 10"]], fmt, v => fmt = v);
    const go = DT.button("번호 넣어 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(S.st, async () => {
      const doc = await DT.loadLib(S.pdf.bytes), font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const pages = doc.getPages(), list = pagesOf(range.value, pages.length).filter(i => !(skip1.checked && i === 0));
      const total = list.length, fs = +size.value || 11, m = +margin.value || 0;
      const hex = color.value, rgb = PDFLib.rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
      list.forEach((pi, k) => {
        const n = (+start.value || 0) + k, N = (+start.value || 0) + total - 1;
        const text = { n: `${n}`, nN: `${n} / ${N}`, dash: `- ${n} -`, p: `p. ${n}`, page: `Page ${n} of ${N}` }[fmt];
        const page = pages[pi], g = pageGeom(page), w = font.widthOfTextAtSize(text, fs);
        const vx = pos[1] === "l" ? m : pos[1] === "c" ? (g.VW - w) / 2 : g.VW - m - w;
        const vy = pos[0] === "b" ? m : g.VH - m - fs * .75;
        page.drawText(text, { ...placeOpts(g, vx, vy), size: fs, font, color: rgb });
      });
      DT.save(await doc.save(), DT.baseName(S.pdf.name) + "_쪽번호.pdf");
      S.st.ok(`${list.length}쪽에 번호를 넣었어요.`);
    });
    S.work.append(h("div", { class: "opts" }, DT.field("위치", posSeg), DT.field("모양", fmtSeg)),
      h("div", { class: "opts" }, DT.field("시작 번호", start), DT.field("글자 크기(pt)", size), DT.field("가장자리에서(pt)", margin), DT.field("색", color), DT.field("쪽 범위", range), h("label", { class: "check" }, skip1, "첫 쪽(표지)은 빼기"), go));
  } });

/* ------------------------------------------------------------------ */
DT.register({ id: "watermark", group: "edit", order: 3, name: "워터마크 넣기", desc: "'대외비'·학교 이름·로고", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  long: "모든 쪽에 글자나 그림(학교 로고 등)을 흐리게 겹쳐 넣어요. 한글도 쓸 수 있어요.",
  mount(root){
    let kind = "text", layout = "center", layer = "top";
    const txt = h("input", { type: "text", value: "아화중학교", style: { width: "200px" } });
    const color = h("input", { type: "color", value: "#d0302f" }), size = h("input", { type: "number", value: 60, min: 8, max: 300 });
    const angle = h("input", { type: "number", value: 45, min: -180, max: 180 }), opac = h("input", { type: "range", min: 5, max: 100, value: 25 });
    const bold = h("input", { type: "checkbox", checked: true }), range = h("input", { type: "text", placeholder: "비우면 전체", style: { width: "120px" } });
    let imgFile = null;
    const imgDrop = DT.dropZone({ accept: "image/png,image/jpeg", multiple: false, title: "워터마크 그림 고르기 (PNG·JPG)", hint: "배경이 투명한 PNG 로고가 가장 좋아요", onFiles: fs => { imgFile = fs[0]; imgDrop.querySelector("b").textContent = "🖼️ " + imgFile.name; draw(); } });
    imgDrop.classList.add("small", "hidden");
    const textOpts = h("div", { class: "opts" }, DT.field("글자", txt), DT.field("색", color), h("label", { class: "check" }, bold, "굵게"));
    const prevC = h("canvas", { style: { maxWidth: "100%", boxShadow: "0 4px 16px rgba(0,0,0,.15)", background: "#fff" } });
    const S = onePdf(root, { onReady: () => draw() });
    [txt, color, size, angle, opac, bold].forEach(e => e.addEventListener("input", () => draw()));
    async function stampCanvas(){
      if (kind === "img"){ if (!imgFile) return null; return DT.imageToCanvas(imgFile, 1600); }
      return DT.textCanvas(txt.value || " ", { size: 160, color: color.value, bold: bold.checked });
    }
    /* 보이는 쪽 크기(VW×VH)에서 놓을 자리들: [가운데 x, 가운데 y] */
    function spots(VW, VH, w, hh){
      if (layout === "center") return [[VW / 2, VH / 2]];
      const out = [], dx = w * 1.5 + 40, dy = hh * 2.6 + 40;
      for (let y = dy / 2; y < VH + dy; y += dy) for (let x = (Math.round(y / dy) % 2 ? dx / 2 : 0); x < VW + dx; x += dx) out.push([x, y]);
      return out;
    }
    const sizeOf = sc => { const wpt = kind === "img" ? (+size.value || 60) * 3 : (+size.value || 60) * sc.width / 160 * .95; return [wpt, wpt * sc.height / sc.width]; };
    let drawT = 0;
    async function draw(){
      clearTimeout(drawT); drawT = setTimeout(async () => {
        if (!S.pdf) return;
        const r = await DT.renderPage(S.pdf.doc, 1, { maxSide: 520 }), sc = await stampCanvas();
        prevC.width = r.canvas.width; prevC.height = r.canvas.height; const g = prevC.getContext("2d"); g.drawImage(r.canvas, 0, 0);
        if (!sc) return;
        const k = r.canvas.width / r.widthPt, [w, hh] = sizeOf(sc);
        g.globalAlpha = +opac.value / 100;
        for (const [cx, cy] of spots(r.widthPt, r.heightPt, w, hh)){ g.save(); g.translate(cx * k, cy * k); g.rotate(-(+angle.value || 0) * Math.PI / 180); g.drawImage(sc, -w * k / 2, -hh * k / 2, w * k, hh * k); g.restore(); }
      }, 120);
    }
    const go = DT.button("워터마크 넣어 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(S.st, async () => {
      const sc = await stampCanvas(); if (!sc) throw new Error("워터마크 그림을 골라 주세요.");
      const doc = await DT.loadLib(S.pdf.bytes);
      const img = await doc.embedPng(await DT.canvasBytes(sc, "image/png"));
      const pages = doc.getPages(), list = pagesOf(range.value, pages.length), th = +angle.value || 0, rad = th * Math.PI / 180;
      for (const pi of list){
        const page = pages[pi], g = pageGeom(page), [w, hh] = sizeOf(sc);
        for (const [cx, cyTop] of spots(g.VW, g.VH, w, hh)){
          const cy = g.VH - cyTop;
          // 가운데가 (cx,cy) 가 되도록 왼쪽 아래 모서리 계산
          const vx = cx - (w / 2 * Math.cos(rad) - hh / 2 * Math.sin(rad)), vy = cy - (w / 2 * Math.sin(rad) + hh / 2 * Math.cos(rad));
          page.drawImage(img, { ...placeOpts(g, vx, vy, th), width: w, height: hh, opacity: +opac.value / 100 });
        }
        if (layer === "under" && page.contentStreamRef){ // 새로 그린 내용을 맨 앞으로 옮겨서 원래 내용 아래에 깔리게
          const arr = page.node.normalizedEntries().Contents, ref = page.contentStreamRef;
          for (let i = arr.size() - 1; i >= 0; i--) if (arr.get(i) === ref) arr.remove(i);
          arr.insert(0, ref);
        }
      }
      DT.save(await doc.save(), DT.baseName(S.pdf.name) + "_워터마크.pdf");
      S.st.ok(`${list.length}쪽에 워터마크를 넣었어요.`);
    });
    S.work.append(
      h("div", { class: "opts" },
        DT.field("종류", DT.seg([["text", "글자"], ["img", "그림"]], kind, v => { kind = v; textOpts.classList.toggle("hidden", v !== "text"); imgDrop.classList.toggle("hidden", v !== "img"); draw(); })),
        DT.field("배치", DT.seg([["center", "가운데 하나"], ["tile", "바둑판 반복"]], layout, v => { layout = v; draw(); })),
        DT.field("겹치기", DT.seg([["top", "내용 위"], ["under", "내용 아래"]], layer, v => layer = v))),
      textOpts, imgDrop,
      h("div", { class: "opts" }, DT.field("크기", size), DT.field("기울기(°)", angle), DT.field("진하기", opac), DT.field("쪽 범위", range), go),
      h("div", { class: "row" }, h("span", { style: { fontSize: "13px", fontWeight: 700, color: "var(--sub)" } }, "첫 쪽 미리보기")), prevC);
  } });

/* ------------------------------------------------------------------ */
DT.register({ id: "crop", group: "edit", order: 4, name: "PDF 자르기", desc: "여백·필요 없는 부분 잘라내기", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
  long: "미리보기에서 <b>남길 부분을 끌어서</b> 고르면 그 바깥을 잘라내요. '여백 자동 찾기'로 하얀 여백만 잘라낼 수도 있어요.",
  mount(root){
    let cur = 0, applyAll = "all";
    const rects = {};   // 쪽 번호 → {l,t,r,b} (0~1 비율, 보이는 모습 기준)
    const base = h("canvas"), over = h("canvas", { style: { position: "absolute", left: 0, top: 0, cursor: "crosshair", touchAction: "none" } });
    const stage = h("div", { class: "stage" }, h("div", { class: "stage-inner" }, base, over));
    const label = h("span"), prev = h("button", { class: "mini", type: "button" }, "◀ 이전 쪽"), next = h("button", { class: "mini", type: "button" }, "다음 쪽 ▶");
    const S = onePdf(root, { onReady: async () => { cur = 0; await show(); } });
    let R = null;
    const rectOf = () => rects[applyAll === "all" ? "all" : cur] || rects.all || null;
    async function show(){
      label.textContent = `${cur + 1} / ${S.pdf.numPages}쪽`;
      R = await DT.renderPage(S.pdf.doc, cur + 1, { maxSide: Math.min(900, window.innerWidth - 80) });
      base.width = over.width = R.canvas.width; base.height = over.height = R.canvas.height;
      base.getContext("2d").drawImage(R.canvas, 0, 0); paint();
    }
    function paint(){
      const g = over.getContext("2d"), W = over.width, H = over.height; g.clearRect(0, 0, W, H);
      const r = rectOf(); if (!r) return;
      g.fillStyle = "rgba(20,25,50,.55)"; g.fillRect(0, 0, W, H);
      g.clearRect(r.l * W, r.t * H, (r.r - r.l) * W, (r.b - r.t) * H);
      g.strokeStyle = "#f0743a"; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(r.l * W, r.t * H, (r.r - r.l) * W, (r.b - r.t) * H);
      g.setLineDash([]); g.fillStyle = "#f0743a";
      for (const [x, y] of [[r.l, r.t], [r.r, r.t], [r.l, r.b], [r.r, r.b]]) g.fillRect(x * W - 6, y * H - 6, 12, 12);
      const mm = v => Math.round(v * 25.4 / 72);
      info.textContent = `남길 크기: ${mm((r.r - r.l) * R.widthPt)} × ${mm((r.b - r.t) * R.heightPt)} mm`;
    }
    const info = h("span", { style: { fontSize: "13px", color: "var(--sub)" } });
    let drag = null;
    const pt = e => { const b = over.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; };
    over.addEventListener("pointerdown", e => {
      over.setPointerCapture(e.pointerId); const [x, y] = pt(e), r = rectOf();
      const near = (a, b) => Math.abs(a - b) < 14 / over.width * 1.5;
      if (r){
        const hx = near(x, r.l) ? "l" : near(x, r.r) ? "r" : null, hy = near(y, r.t) ? "t" : near(y, r.b) ? "b" : null;
        if (hx || hy){ drag = { mode: "edge", hx, hy }; return; }
        if (x > r.l && x < r.r && y > r.t && y < r.b){ drag = { mode: "move", x, y, r: { ...r } }; return; }
      }
      drag = { mode: "new", x, y };
    });
    over.addEventListener("pointermove", e => {
      if (!drag) return; const [x, y] = pt(e); const key = applyAll === "all" ? "all" : cur;
      if (drag.mode === "new") rects[key] = { l: Math.min(x, drag.x), r: Math.max(x, drag.x), t: Math.min(y, drag.y), b: Math.max(y, drag.y) };
      else if (drag.mode === "move"){ const o = drag.r, dx = Math.min(1 - o.r, Math.max(-o.l, x - drag.x)), dy = Math.min(1 - o.b, Math.max(-o.t, y - drag.y)); rects[key] = { l: o.l + dx, r: o.r + dx, t: o.t + dy, b: o.b + dy }; }
      else { const r = { ...rectOf() }; if (drag.hx) r[drag.hx] = x; if (drag.hy) r[drag.hy] = y; rects[key] = { l: Math.min(r.l, r.r), r: Math.max(r.l, r.r), t: Math.min(r.t, r.b), b: Math.max(r.t, r.b) }; }
      paint();
    });
    over.addEventListener("pointerup", () => { drag = null; const r = rectOf(); if (r && (r.r - r.l < .02 || r.b - r.t < .02)){ delete rects[applyAll === "all" ? "all" : cur]; paint(); } });
    prev.onclick = () => { if (cur > 0){ cur--; show(); } };
    next.onclick = () => { if (cur < S.pdf.numPages - 1){ cur++; show(); } };
    /* 하얀 여백 자동 찾기 */
    async function autoBox(i){
      const r = await DT.renderPage(S.pdf.doc, i + 1, { maxSide: 600 }), c = r.canvas, d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++){ const k = (y * c.width + x) * 4; if (d[k] < 235 || d[k + 1] < 235 || d[k + 2] < 235){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 < 0) return null;
      const pad = 8 * c.width / r.widthPt;   // 8pt 여유
      return { l: Math.max(0, (x0 - pad) / c.width), t: Math.max(0, (y0 - pad) / c.height), r: Math.min(1, (x1 + pad) / c.width), b: Math.min(1, (y1 + pad) / c.height) };
    }
    const autoBtn = h("button", { class: "mini", type: "button", onclick: () => DT.guard(S.st, async () => {
      S.st.busy("여백을 찾는 중…");
      if (applyAll === "all"){ // 모든 쪽을 다 포함하는 상자
        let u = null; for (let i = 0; i < S.pdf.numPages; i++){ const b = await autoBox(i); if (b) u = u ? { l: Math.min(u.l, b.l), t: Math.min(u.t, b.t), r: Math.max(u.r, b.r), b: Math.max(u.b, b.b) } : b; S.prog.set(i + 1, S.pdf.numPages); }
        S.prog.done(); if (u) rects.all = u;
      } else { const b = await autoBox(cur); if (b) rects[cur] = b; }
      S.st.set("주황색 상자 안이 남아요. 필요하면 상자를 끌어서 고치세요."); paint();
    }) }, "✨ 여백 자동 찾기");
    const clearBtn = h("button", { class: "mini", type: "button", onclick: () => { delete rects[applyAll === "all" ? "all" : cur]; paint(); } }, "상자 지우기");
    const go = DT.button("잘라서 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(S.st, async () => {
      if (!rects.all && !Object.keys(rects).length) throw new Error("남길 부분을 미리보기에서 끌어서 골라 주세요.");
      const doc = await DT.loadLib(S.pdf.bytes); let n = 0;
      doc.getPages().forEach((page, i) => {
        const r = applyAll === "all" ? rects.all : rects[i]; if (!r) return;
        const g = pageGeom(page);
        const a = toContent(g, r.l * g.VW, (1 - r.b) * g.VH), b = toContent(g, r.r * g.VW, (1 - r.t) * g.VH);
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), hh = Math.abs(a.y - b.y);
        page.setCropBox(x, y, w, hh); page.setMediaBox(x, y, w, hh); n++;
      });
      DT.save(await doc.save(), DT.baseName(S.pdf.name) + "_자르기.pdf");
      S.st.ok(`${n}쪽을 잘랐어요.`);
    });
    S.work.append(h("div", { class: "opts" },
      DT.field("적용할 쪽", DT.seg([["all", "모든 쪽 똑같이"], ["each", "쪽마다 따로"]], applyAll, v => { applyAll = v; paint(); })), autoBtn, clearBtn, go),
      h("div", { class: "pager" }, prev, label, next, info), stage);
  } });

/* ------------------------------------------------------------------ */
/* ======= PDF 편집기: 글자·펜·형광펜·도형·화이트·그림·도장 ======= */
DT.register({ id: "edit", group: "edit", order: 5, name: "PDF 편집", desc: "글자·그림·펜·도형 넣기", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  long: "PDF 위에 글자를 쓰고, 펜·형광펜으로 표시하고, 도형·서명 그림·✓ 도장을 넣어요. <b>화이트</b>로 원래 글자를 가리고 그 위에 새로 쓸 수도 있어요.",
  mount(root){
    const objs = {}; const undo = [];
    let cur = 0, tool = "text", color = "#1d4ed8", lw = 2, fsz = 14, sel = null, R = null, K = 1;
    const base = h("canvas"), over = h("canvas", { style: { position: "absolute", left: 0, top: 0, touchAction: "none" } });
    const inner = h("div", { class: "stage-inner" }, base, over), stage = h("div", { class: "stage" }, inner);
    const label = h("span");
    const S = onePdf(root, { onReady: async () => { cur = 0; for (const k in objs) delete objs[k]; await show(); } });
    const list = () => (objs[cur] ||= []);
    const TOOLS = [["select", "🖱️ 선택·이동"], ["text", "T 글자"], ["pen", "✏️ 펜"], ["hl", "🖍️ 형광펜"], ["rect", "▭ 사각형"], ["ellipse", "◯ 원"], ["line", "／ 선"], ["arrow", "→ 화살표"], ["white", "⬜ 화이트"], ["stamp", "✓ 도장"], ["img", "🖼️ 그림·서명"]];
    const tb = h("div", { class: "toolbar" });
    const toolBtns = TOOLS.map(([id, t]) => { const b = h("button", { type: "button", class: "tb" + (id === tool ? " on" : ""), onclick: () => setTool(id) }, t); tb.append(b); return [id, b]; });
    tb.append(h("span", { class: "sep" }));
    const colorIn = h("input", { type: "color", value: color, title: "색" }); colorIn.oninput = () => { color = colorIn.value; if (sel && "color" in sel){ snap(); sel.color = color; paint(); } };
    const lwIn = h("select", {}, ...[1, 2, 3, 5, 8].map(v => h("option", { value: v, selected: v === lw || null }, `굵기 ${v}`))); lwIn.onchange = () => { lw = +lwIn.value; if (sel && "w" in sel){ snap(); sel.w = lw; paint(); } };
    const fsIn = h("select", {}, ...[9, 11, 12, 14, 16, 20, 24, 32, 48].map(v => h("option", { value: v, selected: v === fsz || null }, `글자 ${v}pt`))); fsIn.onchange = () => { fsz = +fsIn.value; if (sel && sel.t === "text"){ snap(); sel.size = fsz; paint(); } };
    const stampIn = h("select", {}, ...["✓", "✗", "○", "△", "★", "참 잘했어요", "확인", "완료"].map(v => h("option", { value: v }, `도장 ${v}`)));
    tb.append(colorIn, lwIn, fsIn, stampIn, h("span", { class: "sep" }),
      h("button", { type: "button", class: "tb", onclick: () => { const u = undo.pop(); if (u){ objs[u.page] = u.list; paint(); } } }, "↶ 되돌리기"),
      h("button", { type: "button", class: "tb", onclick: () => { if (sel){ snap(); list().splice(list().indexOf(sel), 1); sel = null; paint(); } } }, "🗑 지우기"));
    const imgPick = h("input", { type: "file", accept: "image/*", hidden: true });
    let pendingImg = null;
    imgPick.onchange = async () => { const f = imgPick.files[0]; imgPick.value = ""; if (!f) return; pendingImg = await DT.imageToCanvas(f, 1200); DT.toast("그림을 넣을 자리를 누르세요"); };
    function setTool(id){ tool = id; toolBtns.forEach(([i, b]) => b.classList.toggle("on", i === id)); over.style.cursor = id === "select" ? "default" : "crosshair"; if (id === "img") imgPick.click(); }
    const snap = () => undo.push({ page: cur, list: list().map(o => ({ ...o, pts: o.pts ? o.pts.map(p => [...p]) : undefined })) });
    async function show(){
      sel = null; label.textContent = `${cur + 1} / ${S.pdf.numPages}쪽`;
      const avail = Math.min(980, (stage.clientWidth || window.innerWidth) - 40);
      R = await DT.renderPage(S.pdf.doc, cur + 1, { scale: avail / (await S.pdf.doc.getPage(cur + 1)).getViewport({ scale: 1 }).width * (window.devicePixelRatio || 1) });
      K = R.canvas.width / R.widthPt;
      for (const c of [base, over]){ c.width = R.canvas.width; c.height = R.canvas.height; c.style.width = R.canvas.width / (window.devicePixelRatio || 1) + "px"; c.style.height = R.canvas.height / (window.devicePixelRatio || 1) + "px"; }
      base.getContext("2d").drawImage(R.canvas, 0, 0); paint();
    }
    function drawObj(g, o, k){
      g.save(); g.lineCap = "round"; g.lineJoin = "round";
      if (o.t === "pen" || o.t === "hl"){
        g.strokeStyle = o.color; g.lineWidth = o.w * k; g.globalAlpha = o.t === "hl" ? .35 : 1;
        if (o.t === "hl") g.globalCompositeOperation = "multiply";
        g.beginPath(); o.pts.forEach(([x, y], i) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.stroke();
      } else if (o.t === "rect" || o.t === "white"){
        if (o.t === "white"){ const x0 = Math.floor(Math.min(o.x, o.x + o.w2) * k), y0 = Math.floor(Math.min(o.y, o.y + o.h) * k); g.fillStyle = "#fff"; g.fillRect(x0, y0, Math.ceil(Math.max(o.x, o.x + o.w2) * k) - x0, Math.ceil(Math.max(o.y, o.y + o.h) * k) - y0); }
        else { g.strokeStyle = o.color; g.lineWidth = o.w * k; g.strokeRect(o.x * k, o.y * k, o.w2 * k, o.h * k); }
      } else if (o.t === "ellipse"){
        g.strokeStyle = o.color; g.lineWidth = o.w * k; g.beginPath(); g.ellipse((o.x + o.w2 / 2) * k, (o.y + o.h / 2) * k, Math.abs(o.w2 / 2) * k, Math.abs(o.h / 2) * k, 0, 0, Math.PI * 2); g.stroke();
      } else if (o.t === "line" || o.t === "arrow"){
        g.strokeStyle = g.fillStyle = o.color; g.lineWidth = o.w * k; g.beginPath(); g.moveTo(o.x1 * k, o.y1 * k); g.lineTo(o.x2 * k, o.y2 * k); g.stroke();
        if (o.t === "arrow"){ const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), s = (6 + o.w * 2.5) * k; g.beginPath(); g.moveTo(o.x2 * k, o.y2 * k); g.lineTo(o.x2 * k - s * Math.cos(a - .45), o.y2 * k - s * Math.sin(a - .45)); g.lineTo(o.x2 * k - s * Math.cos(a + .45), o.y2 * k - s * Math.sin(a + .45)); g.closePath(); g.fill(); }
      } else if (o.t === "text"){
        g.fillStyle = o.color; g.font = `${o.bold ? 700 : 400} ${o.size * k}px 'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif`; g.textBaseline = "top";
        String(o.text).split("\n").forEach((l, i) => g.fillText(l, o.x * k, (o.y + i * o.size * 1.3) * k));
      } else if (o.t === "img"){ g.drawImage(o.src, o.x * k, o.y * k, o.w2 * k, o.h * k); }
      g.restore();
    }
    function bbox(o){
      if (o.pts){ const xs = o.pts.map(p => p[0]), ys = o.pts.map(p => p[1]); return { x: Math.min(...xs) - o.w, y: Math.min(...ys) - o.w, w: Math.max(...xs) - Math.min(...xs) + o.w * 2, h: Math.max(...ys) - Math.min(...ys) + o.w * 2 }; }
      if (o.t === "line" || o.t === "arrow") return { x: Math.min(o.x1, o.x2) - 4, y: Math.min(o.y1, o.y2) - 4, w: Math.abs(o.x2 - o.x1) + 8, h: Math.abs(o.y2 - o.y1) + 8 };
      if (o.t === "text"){ const g = over.getContext("2d"); g.font = `${o.bold ? 700 : 400} ${o.size}px 'Malgun Gothic',sans-serif`; const ls = String(o.text).split("\n"); return { x: o.x, y: o.y, w: Math.max(...ls.map(l => g.measureText(l).width), 8), h: ls.length * o.size * 1.3 }; }
      return { x: Math.min(o.x, o.x + o.w2), y: Math.min(o.y, o.y + o.h), w: Math.abs(o.w2), h: Math.abs(o.h) };
    }
    function paint(){
      const g = over.getContext("2d"); g.clearRect(0, 0, over.width, over.height);
      for (const o of list()) drawObj(g, o, K);
      if (sel){ const b = bbox(sel); g.save(); g.strokeStyle = "#f0743a"; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.strokeRect(b.x * K - 3, b.y * K - 3, b.w * K + 6, b.h * K + 6); g.restore(); }
    }
    const P = e => { const b = over.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * over.width / K, (e.clientY - b.top) / b.height * over.height / K]; };
    let act = null;
    over.addEventListener("pointerdown", e => {
      if (!S.pdf) return; over.setPointerCapture(e.pointerId); const [x, y] = P(e);
      if (tool === "select"){
        sel = [...list()].reverse().find(o => { const b = bbox(o); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }) || null;
        if (sel){ snap(); act = { mode: "move", x, y, o: JSON.parse(JSON.stringify({ ...sel, src: undefined })) }; }
        paint(); return;
      }
      if (tool === "text"){ editText({ t: "text", x, y: y - fsz * .5, text: "", size: fsz, color, bold: false }, true); return; }
      if (tool === "stamp"){ snap(); const s = stampIn.value, sz = s.length > 2 ? fsz * 1.4 : fsz * 2.2; const o = { t: "text", x: x - sz * .35, y: y - sz * .6, text: s, size: sz, color: s.length > 2 ? "#d0302f" : color, bold: true }; list().push(o); sel = o; paint(); return; }
      if (tool === "img"){ if (!pendingImg){ imgPick.click(); return; } snap(); const w = Math.min(160, R.widthPt / 3), o = { t: "img", x: x - w / 2, y: y - w * pendingImg.height / pendingImg.width / 2, w2: w, h: w * pendingImg.height / pendingImg.width, src: pendingImg }; list().push(o); sel = o; paint(); setTool("select"); return; }
      snap();
      let o;
      if (tool === "pen" || tool === "hl") o = { t: tool, pts: [[x, y]], color: tool === "hl" ? (color === "#1d4ed8" ? "#ffe100" : color) : color, w: tool === "hl" ? Math.max(10, lw * 5) : lw };
      else if (tool === "line" || tool === "arrow") o = { t: tool, x1: x, y1: y, x2: x, y2: y, color, w: lw };
      else o = { t: tool, x, y, w2: 0, h: 0, color, w: lw };
      list().push(o); act = { mode: "draw", o, x, y };
    });
    over.addEventListener("pointermove", e => {
      if (!act) return; const [x, y] = P(e), o = act.o;
      if (act.mode === "move"){
        const dx = x - act.x, dy = y - act.y, s = act.o;
        if (sel.pts) sel.pts = s.pts.map(([a, b]) => [a + dx, b + dy]);
        else if ("x1" in sel){ sel.x1 = s.x1 + dx; sel.x2 = s.x2 + dx; sel.y1 = s.y1 + dy; sel.y2 = s.y2 + dy; }
        else { sel.x = s.x + dx; sel.y = s.y + dy; }
      } else if (o.pts) o.pts.push([x, y]);
      else if ("x1" in o){ o.x2 = x; o.y2 = y; }
      else { o.w2 = x - act.x; o.h = y - act.y; }
      paint();
    });
    over.addEventListener("pointerup", () => {
      if (act && act.mode === "draw"){ const o = act.o; if ("w2" in o){ if (o.w2 < 0){ o.x += o.w2; o.w2 = -o.w2; } if (o.h < 0){ o.y += o.h; o.h = -o.h; } if (o.w2 < 2 && o.h < 2) list().pop(); } }
      act = null; paint();
    });
    over.addEventListener("dblclick", e => { const [x, y] = P(e); const o = [...list()].reverse().find(o => o.t === "text" && (b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)(bbox(o))); if (o) editText(o, false); });
    document.addEventListener("keydown", keyDel); window.__dtCleanup.push(() => document.removeEventListener("keydown", keyDel));
    function keyDel(e){ if (sel && (e.key === "Delete" || e.key === "Backspace") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)){ snap(); list().splice(list().indexOf(sel), 1); sel = null; paint(); e.preventDefault(); } }
    function editText(o, isNew){
      const d = window.devicePixelRatio || 1, ta = h("textarea", { style: { position: "absolute", left: o.x * K / d + "px", top: o.y * K / d + "px", font: `${o.size * K / d}px 'Malgun Gothic',sans-serif`, color: o.color, background: "rgba(255,255,255,.85)", border: "1.5px dashed #f0743a", padding: "0", margin: "0", minWidth: "120px", minHeight: o.size * K / d * 1.4 + "px", lineHeight: "1.3", resize: "both", zIndex: 5, outline: "none" } });
      ta.value = o.text; inner.append(ta); setTimeout(() => ta.focus(), 0);
      if (!isNew){ o._hide = o.text; o.text = ""; paint(); }
      const done = () => { const v = ta.value.replace(/\s+$/, ""); ta.remove(); if (!v){ if (!isNew) list().splice(list().indexOf(o), 1); paint(); return; } snap(); o.text = v; delete o._hide; if (isNew) list().push(o); sel = o; paint(); };
      ta.addEventListener("blur", done, { once: true });
      ta.addEventListener("keydown", e => { if (e.key === "Escape") ta.blur(); });
    }
    const go = DT.button("편집한 PDF 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(S.st, async () => {
      const doc = await DT.loadLib(S.pdf.bytes); let n = 0;
      const pages = doc.getPages();
      for (const [pi, arr] of Object.entries(objs)){
        if (!arr.length) continue;
        const page = pages[+pi], g = pageGeom(page);
        const k = Math.min(4, 4000 / Math.max(g.VW, g.VH));
        // 그린 순서를 지키며 묶어서 넣는다. 화이트는 그림이 아닌 진짜 흰 사각형으로 넣어야
        // 가장자리에 회색 테두리가 생기지 않는다.
        let batch = [];
        const flush = async () => {
          if (!batch.length) return;
          const c = document.createElement("canvas"); c.width = Math.round(g.VW * k); c.height = Math.round(g.VH * k);
          const ctx = c.getContext("2d");
          for (const o of batch) drawObj(ctx, o, k);
          const img = await doc.embedPng(await DT.canvasBytes(c, "image/png"));
          page.drawImage(img, { ...placeOpts(g, 0, 0), width: g.VW, height: g.VH });
          batch = [];
        };
        for (const o of arr){
          if (o.t !== "white"){ batch.push(o); continue; }
          await flush();
          const b = bbox(o);
          page.drawRectangle({ ...placeOpts(g, b.x, g.VH - b.y - b.h), width: b.w, height: b.h, color: PDFLib.rgb(1, 1, 1), borderWidth: 0 });
        }
        await flush();
        n++;
      }
      if (!n) throw new Error("아직 아무것도 넣지 않았어요.");
      DT.save(await doc.save(), DT.baseName(S.pdf.name) + "_편집.pdf");
      S.st.ok(`${n}쪽에 편집한 내용을 넣어 저장했어요.`);
    });
    const prev = h("button", { class: "mini", type: "button", onclick: () => { if (cur > 0){ cur--; show(); } } }, "◀ 이전 쪽");
    const next = h("button", { class: "mini", type: "button", onclick: () => { if (cur < S.pdf.numPages - 1){ cur++; show(); } } }, "다음 쪽 ▶");
    S.work.append(tb, h("div", { class: "pager" }, prev, label, next, go), stage, imgPick,
      h("div", { class: "note" }, "💡 글자: 쓸 자리를 누르고 입력한 뒤 바깥을 누르면 들어가요(두 번 누르면 다시 고치기). 선택·이동으로 고른 뒤 Delete 키나 🗑로 지워요. 화이트로 원래 글자를 가린 다음 그 위에 글자를 쓰면 내용을 고칠 수 있어요."));
  } });

/* ------------------------------------------------------------------ */
DT.register({ id: "forms", group: "edit", order: 6, name: "PDF 양식 작성", desc: "입력 칸 채우기", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h6M7 14h10"/></svg>',
  long: "입력 칸(양식)이 들어 있는 PDF(신청서·동의서 등)의 칸을 채워 저장해요. <b>내용 고정</b>을 고르면 받은 사람이 고칠 수 없게 글자가 박혀요.",
  mount(root){
    let lock = "keep", doc = null, form = null;
    const tbl = h("div", { class: "flist" }), preview = h("div", { class: "pgrid", style: { gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" } });
    const S = onePdf(root, { onReady: async p => {
      doc = await DT.loadLib(p.bytes); form = doc.getForm();
      const fields = form.getFields().filter(f => kindOf(f));
      tbl.innerHTML = ""; preview.innerHTML = "";
      if (!fields.length){ tbl.append(h("div", { class: "note" }, "이 PDF에는 입력 칸(양식)이 없어요. 'PDF 편집'에서 원하는 자리에 글자를 넣을 수 있어요.")); go.disabled = true; return; }
      go.disabled = false;
      const pages = doc.getPages(), marks = {};
      fields.forEach((f, i) => {
        const name = f.getName(), type = kindOf(f), no = i + 1;
        let input;
        if (type === "PDFTextField"){ input = h(f.isMultiline() ? "textarea" : "input", { type: "text", value: f.getText() || "", style: { flex: 1, minWidth: "180px", padding: "7px 9px", border: "1.5px solid #d4d7e6", borderRadius: "9px" } }); input.oninput = () => f.setText(input.value); }
        else if (type === "PDFCheckBox"){ input = h("input", { type: "checkbox", checked: f.isChecked() || null, style: { width: "20px", height: "20px" } }); input.onchange = () => input.checked ? f.check() : f.uncheck(); }
        else if (type === "PDFRadioGroup" || type === "PDFDropdown" || type === "PDFOptionList"){
          const opts = f.getOptions(), now = type === "PDFRadioGroup" ? f.getSelected() : (f.getSelected() || [])[0];
          input = h("select", { style: { padding: "7px", borderRadius: "9px", border: "1.5px solid #d4d7e6" } }, h("option", { value: "" }, "(선택 안 함)"), ...opts.map(o => h("option", { value: o, selected: o === now || null }, o)));
          input.onchange = () => { if (!input.value){ if (type === "PDFRadioGroup") f.clear(); else f.clear(); } else f.select(input.value); };
        } else return;
        tbl.append(h("div", { class: "fitem" }, h("b", { style: { background: "#4f46e5", color: "#fff", borderRadius: "6px", padding: "1px 7px", fontSize: "12px" } }, no), h("span", { class: "fname", style: { maxWidth: "260px" } }, name), input));
        for (const w of f.acroField.getWidgets()){
          const pg = form.findWidgetPage ? form.findWidgetPage(w) : null, pi = pg ? pages.indexOf(pg) : 0;
          (marks[pi] ||= []).push({ no, rect: w.getRectangle() });
        }
      });
      // 쪽 미리보기 + 칸 번호
      for (const [pi, ms] of Object.entries(marks).slice(0, 6)){
        const r = await DT.renderPage(p.doc, +pi + 1, { maxSide: 700 }), c = r.canvas, g = c.getContext("2d"), page = pages[+pi], gm = pageGeom(page);
        const k = c.width / gm.VW;
        g.lineWidth = 2; g.font = "bold 13px sans-serif";
        for (const m of ms){
          // 칸 위치(내부 좌표) → 보이는 좌표
          const pts = [[m.rect.x, m.rect.y], [m.rect.x + m.rect.width, m.rect.y + m.rect.height]].map(([x, y]) => { const u = x - gm.x0, v = y - gm.y0; const [vx, vy] = gm.R === 90 ? [v, gm.W - u] : gm.R === 180 ? [gm.W - u, gm.H - v] : gm.R === 270 ? [gm.H - v, u] : [u, v]; return [vx * k, (gm.VH - vy) * k]; });
          const x = Math.min(pts[0][0], pts[1][0]), y = Math.min(pts[0][1], pts[1][1]), w = Math.abs(pts[0][0] - pts[1][0]), hh = Math.abs(pts[0][1] - pts[1][1]);
          g.strokeStyle = "rgba(79,70,229,.9)"; g.fillStyle = "rgba(79,70,229,.12)"; g.fillRect(x, y, w, hh); g.strokeRect(x, y, w, hh);
          g.fillStyle = "#4f46e5"; g.fillRect(x - 2, y - 16, 22, 16); g.fillStyle = "#fff"; g.fillText(m.no, x + 2, y - 4);
        }
        c.style.width = "100%"; c.style.height = "auto";
        preview.append(h("div", { style: { background: "#fff", padding: "6px", borderRadius: "10px", lineHeight: 0, position: "relative" } }, c, h("span", { class: "pnum" }, `${+pi + 1}쪽`)));
      }
    } });
    const go = DT.button("작성한 PDF 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    const isLatin = s => /^[\x20-\x7E -ÿ\r\n\t]*$/.test(s);
    go.onclick = () => DT.guard(S.st, async () => {
      const fields = form.getFields();
      const texty = fields.filter(f => /TextField|Dropdown|OptionList/.test(kindOf(f)));
      const korean = texty.some(f => { const v = kindOf(f) === "PDFTextField" ? f.getText() || "" : (f.getSelected() || []).join(""); return !isLatin(v); });
      const pages = doc.getPages();
      const valOf = f => kindOf(f) === "PDFTextField" ? f.getText() || "" : (f.getSelected() || []).join(", ");
      // 칸 하나에 들어갈 글자 그림과, 칸 안(보이는 모습 기준, 왼쪽 아래 원점)에서의 자리
      const fit = (f, w, v) => {
        const page = form.findWidgetPage(w) || pages[0], gm = pageGeom(page), r = w.getRectangle();
        const multi = kindOf(f) === "PDFTextField" && f.isMultiline();
        const boxW = gm.R % 180 ? r.height : r.width, boxH = gm.R % 180 ? r.width : r.height;
        const fsPt = multi ? 10 : Math.max(6, Math.min(14, boxH * .62));
        const tc = DT.textCanvas(v, { size: fsPt * 4, color: "#000" });
        let w2 = tc.width / 4, h2 = tc.height / 4; const s = Math.min(1, (boxW - 2) / w2, multi ? (boxH - 2) / h2 : 9); w2 *= s; h2 *= s;
        return { page, gm, r, tc, w2, h2, lx: 2, ly: multi ? boxH - h2 - 1 : (boxH - h2) / 2 };
      };
      if (lock === "flat"){
        // 글자 칸: 글자를 그림으로 찍고 칸은 지운다(한글 지원)
        for (const f of texty){
          const v = valOf(f);
          for (const w of f.acroField.getWidgets()){
            if (!v) continue;
            const { page, gm, r, tc, w2, h2, lx, ly } = fit(f, w, v);
            // 칸의 왼쪽 아래 모서리(보이는 모습 기준)
            const c1 = [[r.x, r.y], [r.x + r.width, r.y + r.height]].map(([x, y]) => { const u = x - gm.x0, vv = y - gm.y0; return gm.R === 90 ? [vv, gm.W - u] : gm.R === 180 ? [gm.W - u, gm.H - vv] : gm.R === 270 ? [gm.H - vv, u] : [u, vv]; });
            const vx = Math.min(c1[0][0], c1[1][0]) + lx, vy = Math.min(c1[0][1], c1[1][1]) + ly;
            const img = await doc.embedPng(await DT.canvasBytes(tc, "image/png"));
            page.drawImage(img, { ...placeOpts(gm, vx, vy), width: w2, height: h2 });
          }
          form.removeField(f);
        }
        form.flatten({ updateFieldAppearances: false });
        // 지운 칸을 가리키는 주석 목록 정리
        for (const pg of pages){
          const A = PDFLib.PDFName.of("Annots"), arr = pg.node.lookup(A);
          if (!(arr instanceof PDFLib.PDFArray)) continue;
          const keep = arr.asArray().filter(x => !(x instanceof PDFLib.PDFRef) || doc.context.lookup(x));
          if (keep.length) pg.node.set(A, doc.context.obj(keep)); else pg.node.delete(A);
        }
        // 지운 칸들이 남긴 빈 번호 때문에 일부 프로그램이 경고를 내므로, 새 PDF로 옮겨 담아 깔끔하게 저장
        const out = await PDFLib.PDFDocument.create();
        (await out.copyPages(doc, doc.getPageIndices())).forEach(pg => out.addPage(pg));
        try { const t = doc.getTitle(); if (t) out.setTitle(t); } catch (e) {}
        DT.save(await out.save(), DT.baseName(S.pdf.name) + "_작성.pdf");
        S.st.ok("작성한 내용을 고정해서 저장했어요.");
      } else {
        if (korean){
          // PDF 기본 글꼴에는 한글이 없어서, 한글이 든 칸은 글자를 그림으로 그린 '겉모습'을 직접 만들어 붙인다.
          // 칸은 그대로 남아 있어서 받은 사람이 다시 고칠 수 있다.
          const P = PDFLib, ctx = doc.context, helv = await doc.embedFont(P.StandardFonts.Helvetica);
          for (const f of fields){
            const k = kindOf(f);
            if (!/TextField|Dropdown|OptionList/.test(k)){ try { if (form.fieldIsDirty(f.ref)) f.updateAppearances(); } catch (e) {} continue; }
            const v = valOf(f);
            if (isLatin(v)){ try { f.updateAppearances(helv); } catch (e) {} continue; }
            for (const w of f.acroField.getWidgets()){
              const { gm, r, tc, w2, h2, lx, ly } = fit(f, w, v);
              const lg = { W: r.width, H: r.height, R: gm.R, x0: 0, y0: 0 };
              const o = toContent(lg, lx, ly), sx = toContent(lg, lx + w2, ly), ty = toContent(lg, lx, ly + h2);
              const img = await doc.embedPng(await DT.canvasBytes(tc, "image/png"));
              // 원래 칸의 배경·테두리 색(MK)을 살려서 같이 그린다
              const mk = w.getAppearanceCharacteristics(), bw = (w.getBorderStyle() && w.getBorderStyle().getWidth()) ?? 1;
              const col = a => !a || !a.length ? null : a.length === 1 ? P.setFillingGrayscaleColor(a[0]) : a.length === 3 ? P.setFillingRgbColor(...a) : P.setFillingCmykColor(...a);
              const scol = a => !a || !a.length ? null : a.length === 1 ? P.setStrokingGrayscaleColor(a[0]) : a.length === 3 ? P.setStrokingRgbColor(...a) : P.setStrokingCmykColor(...a);
              const bg = mk && col(mk.getBackgroundColor()), bc = mk && scol(mk.getBorderColor());
              const frame = [];
              if (bg) frame.push(bg, P.rectangle(0, 0, r.width, r.height), P.fill());
              if (bc && bw > 0) frame.push(bc, P.setLineWidth(bw), P.rectangle(bw / 2, bw / 2, r.width - bw, r.height - bw), P.stroke());
              const xo = ctx.formXObject([
                ...frame,
                P.pushGraphicsState(),
                P.concatTransformationMatrix(sx.x - o.x, sx.y - o.y, ty.x - o.x, ty.y - o.y, o.x, o.y),
                P.drawObject("Im0"),
                P.popGraphicsState(),
              ], { BBox: [0, 0, r.width, r.height], Resources: { XObject: { Im0: img.ref } } });
              w.setNormalAppearance(ctx.register(xo));
            }
          }
          form.acroForm.dict.delete(P.PDFName.of("NeedAppearances"));
          DT.save(await doc.save({ updateFieldAppearances: false }), DT.baseName(S.pdf.name) + "_작성.pdf");
          S.st.ok("작성한 PDF를 저장했어요. 받은 사람도 칸을 고칠 수 있어요. (한글 칸은 고치려고 누르면 컴퓨터 글꼴로 다시 그려져요)");
        } else { DT.save(await doc.save(), DT.baseName(S.pdf.name) + "_작성.pdf"); S.st.ok("작성한 PDF를 저장했어요. 받은 사람도 칸을 고칠 수 있어요."); }
      }
    });
    S.work.append(h("div", { class: "opts" }, DT.field("저장 방식", DT.seg([["keep", "계속 고칠 수 있게"], ["flat", "내용 고정(평탄화)"]], lock, v => lock = v)), go), tbl, preview);
  } });
})();
