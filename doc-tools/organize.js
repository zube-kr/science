/* PDF 구성: 합치기 · 분할 · 페이지 제거 · 페이지 추출 · PDF 구성 · PDF로 스캔 */
"use strict";
(() => {
const { h, esc } = DT;
const I = {
  merge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l6 6M20 20l-6-6M4 4v5M4 4h5M20 20v-5M20 20h-5"/></svg>',
  split: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10L4 4M14 14l6 6M4 9V4h5M20 15v5h-5"/></svg>',
  remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  extract: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c2-6 6-9 13-9"/><path d="M14 5l4 4-4 4"/></svg>',
  organize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/><path d="M15 5h4v4M9 19H5v-4"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
};

/* PDF 여러 개 읽기 */
async function readPdfs(files, status){
  const out = [];
  for (const f of DT.filterFiles(files, ["pdf"], "PDF")){
    status.busy(`${esc(f.name)} 여는 중…`);
    try{ const p = await DT.openPdf(f); p.color = DT.nextColor(); out.push(p); }
    catch (e){ DT.toast(e.message, "err"); }
  }
  status.set("");
  return out;
}

/* 한 개짜리 PDF + 페이지 격자 화면 공통 */
function singlePdfTool(root, { gridOpts, onReady, hint }){
  const st = DT.statusBox(), grid = new DT.PageGrid(gridOpts);
  const drop = DT.dropZone({ accept: ".pdf,application/pdf", multiple: false, hint: hint || "PDF 파일 1개", onFiles: async fs => {
    const [p] = await readPdfs(fs, st); if (!p) return;
    state.pdf = p; grid.clear(); grid.add(p);
    drop.classList.add("small"); drop.querySelector("b").textContent = `📄 ${p.name} (${p.numPages}쪽) — 다른 파일로 바꾸려면 누르세요`;
    work.classList.remove("hidden"); onReady && onReady(p);
  } });
  const work = h("div", { class: "hidden" });
  const state = { pdf: null, grid, st, work };
  root.append(drop, work, st);
  return state;
}

/* ------------------------------------------------------------------ */
DT.register({ id: "merge", group: "org", order: 1, name: "PDF 합치기", desc: "여러 PDF를 하나로", icon: I.merge,
  long: "여러 PDF 파일을 원하는 순서대로 하나로 합쳐요. ▲▼ 버튼으로 순서를 바꿀 수 있어요.",
  mount(root){
    const st = DT.statusBox();
    const list = DT.fileList({ onChange: items => { go.disabled = items.length < 2; info.textContent = items.length ? `${items.length}개 파일 · 모두 ${items.reduce((s, x) => s + x.pdf.numPages, 0)}쪽` : ""; } });
    const info = h("span", { class: "fmeta" });
    const drop = DT.dropZone({ accept: ".pdf,application/pdf", hint: "PDF 파일을 2개 이상 올리세요 (한꺼번에 여러 개 가능)", onFiles: async fs => {
      for (const p of await readPdfs(fs, st)) list.items.push({ name: p.name, meta: `${p.numPages}쪽 · ${DT.fmtSize(p.size)}`, color: p.color, pdf: p });
      list.render(); drop.classList.add("small");
    } });
    const go = DT.button("합쳐서 저장", { primary: true, icon: DT.ICON.dl });
    go.classList.add("big"); go.disabled = true;
    go.onclick = () => DT.guard(st, async () => {
      await DT.need("pdflib");
      st.busy("합치는 중…");
      const out = await PDFLib.PDFDocument.create();
      for (const it of list.items){
        const src = await DT.loadLib(it.pdf.bytes);
        for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
      }
      const bytes = await out.save();
      DT.save(bytes, DT.baseName(list.items[0].name) + "_합본.pdf");
      st.ok(`${list.items.length}개 파일(${out.getPageCount()}쪽)을 합쳤어요 · ${DT.fmtSize(bytes.length)}`);
    });
    const sortBtn = h("button", { class: "mini", type: "button", onclick: () => { list.items.sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true })); list.render(); } }, "가나다·번호순 정렬");
    root.append(drop, list, h("div", { class: "row" }, sortBtn, info), h("div", { class: "row" }, go), st);
  } });

/* ------------------------------------------------------------------ */
DT.register({ id: "split", group: "org", order: 2, name: "PDF 분할", desc: "여러 파일로 나누기", icon: I.split,
  long: "한 PDF를 쪽 범위대로, 또는 몇 쪽씩 여러 파일로 나눠요. 결과가 여러 개면 묶음(zip) 파일로 받아요.",
  mount(root){
    let mode = "range";
    const S = singlePdfTool(root, { gridOpts: { select: false }, onReady: p => { rangeIn.placeholder = `예) 1-3, 4-${p.numPages}`; nIn.max = p.numPages; } });
    const rangeIn = h("input", { type: "text", value: "", style: { width: "260px" } });
    const nIn = h("input", { type: "number", value: 1, min: 1 });
    const fRange = DT.field("나눌 범위 (쉼표로 구분, 범위마다 파일 1개)", rangeIn), fN = DT.field("몇 쪽씩?", nIn);
    fN.classList.add("hidden");
    const modes = DT.seg([["range", "범위 지정"], ["every", "N쪽씩"], ["each", "한 쪽씩 모두"]], mode, v => { mode = v; fRange.classList.toggle("hidden", v !== "range"); fN.classList.toggle("hidden", v !== "every"); });
    const go = DT.button("나눠서 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(S.st, async () => {
      const n = S.pdf.numPages;
      let groups;
      if (mode === "range") groups = DT.parseRanges(rangeIn.value, n);
      else { const k = mode === "each" ? 1 : Math.max(1, +nIn.value || 1); groups = []; for (let i = 0; i < n; i += k) groups.push([...Array(Math.min(k, n - i)).keys()].map(j => i + j)); }
      S.st.busy(`${groups.length}개 파일로 나누는 중…`);
      const src = await DT.loadLib(S.pdf.bytes), base = DT.baseName(S.pdf.name), entries = [];
      for (const g of groups){
        const out = await PDFLib.PDFDocument.create();
        for (const p of await out.copyPages(src, g)) out.addPage(p);
        const a = g[0] + 1, b = g[g.length - 1] + 1;
        entries.push({ name: `${base}_${a === b ? a : a + "-" + b}쪽.pdf`, data: await out.save() });
      }
      await DT.saveMany(entries, base + "_분할.zip");
      S.st.ok(`${entries.length}개 파일로 나눴어요${entries.length > 1 ? " (zip 파일로 저장)" : ""}.`);
    });
    S.work.append(h("div", { class: "opts" }, DT.field("나누는 방법", modes), fRange, fN, go), S.grid.el);
  } });

/* ------------------------------------------------------------------ */
function pickTool(id, name, desc, icon, long, verb, order){
  DT.register({ id, group: "org", order, name, desc, icon, long,
    mount(root){
      const S = singlePdfTool(root, { gridOpts: { select: true, onChange: g => { cnt.textContent = g.selected().length; } } });
      const cnt = h("b", {}, "0");
      const rangeIn = h("input", { type: "text", placeholder: "예) 2, 5-7", style: { width: "160px" } });
      const apply = h("button", { class: "mini", type: "button", onclick: () => DT.guard(S.st, () => {
        const idx = new Set(DT.parseRanges(rangeIn.value, S.pdf.numPages).flat());
        S.grid.items.forEach(it => it.sel = idx.has(it.index)); S.grid.render(); S.st.set("");
      }) }, "범위로 고르기");
      const all = h("button", { class: "mini", type: "button", onclick: () => { S.grid.items.forEach(i => i.sel = true); S.grid.render(); } }, "전체 선택");
      const none = h("button", { class: "mini", type: "button", onclick: () => { S.grid.items.forEach(i => i.sel = false); S.grid.render(); } }, "선택 해제");
      let sep = "one";
      const sepSeg = id === "extract" ? DT.seg([["one", "한 파일로"], ["each", "쪽마다 따로(zip)"]], sep, v => sep = v) : null;
      const go = DT.button(verb === "제거" ? "선택한 쪽 빼고 저장" : "선택한 쪽 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
      go.onclick = () => DT.guard(S.st, async () => {
        const sel = S.grid.selected().map(i => i.index);
        if (!sel.length) throw new Error(`${verb}할 쪽을 눌러서 골라 주세요.`);
        const keep = verb === "제거" ? S.grid.items.map(i => i.index).filter(i => !sel.includes(i)) : sel;
        if (!keep.length) throw new Error("모든 쪽을 지우면 빈 파일이 돼요.");
        const src = await DT.loadLib(S.pdf.bytes), base = DT.baseName(S.pdf.name);
        if (sep === "each" && id === "extract"){
          const entries = [];
          for (const i of keep){ const o = await PDFLib.PDFDocument.create(); const [p] = await o.copyPages(src, [i]); o.addPage(p); entries.push({ name: `${base}_${i + 1}쪽.pdf`, data: await o.save() }); }
          await DT.saveMany(entries, base + "_추출.zip");
        } else {
          const o = await PDFLib.PDFDocument.create();
          for (const p of await o.copyPages(src, keep)) o.addPage(p);
          DT.save(await o.save(), `${base}_${verb === "제거" ? "쪽삭제" : "추출"}.pdf`);
        }
        S.st.ok(verb === "제거" ? `${sel.length}쪽을 빼고 ${keep.length}쪽으로 저장했어요.` : `${keep.length}쪽을 꺼내 저장했어요.`);
      });
      S.work.append(h("div", { class: "opts" }, h("span", {}, `${verb}할 쪽을 아래에서 누르세요 · 선택: `, cnt, "쪽"), DT.field("또는 쪽 번호", h("span", { class: "row", style: { margin: 0 } }, rangeIn, apply)), all, none, sepSeg ? DT.field("저장 방식", sepSeg) : null, go), S.grid.el);
    } });
}
pickTool("remove", "페이지 제거", "필요 없는 쪽 지우기", I.remove, "지울 쪽을 눌러서 고른 뒤 저장하면, 그 쪽들이 빠진 새 PDF가 만들어져요.", "제거", 3);
pickTool("extract", "페이지 추출", "원하는 쪽만 꺼내기", I.extract, "필요한 쪽만 골라서 새 PDF로 꺼내요. 한 파일로 모으거나 쪽마다 따로 저장할 수 있어요.", "추출", 4);

/* ------------------------------------------------------------------ */
DT.register({ id: "organize", group: "org", order: 5, name: "PDF 구성", desc: "순서 바꾸기·회전·빈 쪽 넣기", icon: I.organize,
  long: "여러 PDF의 페이지를 섞어서 순서를 바꾸고, 돌리고, 빼고, 빈 페이지를 넣을 수 있어요. 페이지를 <b>끌어다 놓거나</b> ◀ ▶ 버튼으로 옮기세요.",
  mount(root){
    const st = DT.statusBox();
    const grid = new DT.PageGrid({ select: true, del: true, rotate: true, reorder: true, blank: true, onChange: g => { info.textContent = `${g.live().length}쪽`; go.disabled = !g.live().length; } });
    const info = h("b", {}, "0쪽");
    const drop = DT.dropZone({ accept: ".pdf,application/pdf", hint: "PDF를 여러 개 넣으면 페이지를 섞을 수 있어요", onFiles: async fs => {
      for (const p of await readPdfs(fs, st)) grid.add(p);
      drop.classList.add("small"); drop.querySelector("b").textContent = "＋ PDF 더 넣기"; work.classList.remove("hidden");
    } });
    const go = DT.button("이대로 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(st, async () => { st.busy("만드는 중…"); const b = await grid.build(); DT.save(b, (grid.items.find(i => i.src)?.src.name.replace(/\.pdf$/i, "") || "문서") + "_구성.pdf"); st.ok(`${grid.live().length}쪽 PDF를 저장했어요.`); });
    const tgt = () => grid.selected().length ? grid.selected() : grid.live();
    const work = h("div", { class: "hidden" },
      h("div", { class: "opts" },
        h("span", {}, "전체 ", info),
        h("button", { class: "mini", type: "button", onclick: () => { tgt().forEach(i => i.rot -= 90); grid.render(); } }, "↺ 왼쪽 90°"),
        h("button", { class: "mini", type: "button", onclick: () => { tgt().forEach(i => i.rot += 90); grid.render(); } }, "↻ 오른쪽 90°"),
        h("button", { class: "mini", type: "button", onclick: () => { grid.selected().forEach(i => { i.del = true; i.sel = false; }); grid.render(); } }, "선택한 쪽 빼기"),
        h("button", { class: "mini", type: "button", onclick: () => { grid.addBlank(null); } }, "＋ 맨 끝에 빈 페이지"),
        h("button", { class: "mini", type: "button", onclick: () => { grid.items.reverse(); grid.render(); } }, "순서 뒤집기"),
        go),
      h("div", { class: "note" }, "💡 선택한 쪽이 없으면 회전은 <b>모든 쪽</b>에 적용돼요. 페이지 카드의 ＋는 그 뒤에 빈 페이지를 넣어요.".replace(/<b>|<\/b>/g, "")),
      grid.el);
    root.append(drop, work, st);
  } });

/* ------------------------------------------------------------------ */
/* 문서 스캔 필터: 그림자·누런 종이를 하얗게 */
function docFilter(src, mode){
  if (mode === "orig") return src;
  const w = src.width, hh = src.height;
  const out = document.createElement("canvas"); out.width = w; out.height = hh;
  const g = out.getContext("2d"); g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, hh), d = img.data;
  // 배경(종이) 밝기 지도: 작게 줄였다가 다시 키워서 흐리게
  const sw = Math.max(8, Math.round(w / 24)), sh = Math.max(8, Math.round(hh / 24));
  const small = document.createElement("canvas"); small.width = sw; small.height = sh;
  const sg = small.getContext("2d"); sg.filter = "blur(2px)"; sg.drawImage(src, 0, 0, sw, sh);
  // 글자를 지우고 종이만 남기려고 '밝은 값' 위주로: 작은 그림에서 최대 필터
  const sd = sg.getImageData(0, 0, sw, sh).data, bgL = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++){
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
      const xx = Math.min(sw - 1, Math.max(0, x + dx)), yy = Math.min(sh - 1, Math.max(0, y + dy)), k = (yy * sw + xx) * 4;
      m = Math.max(m, .299 * sd[k] + .587 * sd[k + 1] + .114 * sd[k + 2]);
    }
    bgL[y * sw + x] = Math.max(40, m);
  }
  const bgAt = (x, y) => { // 양선형 보간
    const fx = Math.min(sw - 1.001, Math.max(0, x / w * sw - .5)), fy = Math.min(sh - 1.001, Math.max(0, y / hh * sh - .5));
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
    const a = bgL[y0 * sw + x0], b = bgL[y0 * sw + x0 + 1], c = bgL[(y0 + 1) * sw + x0], e = bgL[(y0 + 1) * sw + x0 + 1];
    return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + e * ax) * ay;
  };
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++){
    const k = (y * w + x) * 4, bg = bgAt(x, y), f = 255 / bg;
    if (mode === "gray" || mode === "bw"){
      let L = (.299 * d[k] + .587 * d[k + 1] + .114 * d[k + 2]) * f;
      L = L > 235 ? 255 : Math.pow(Math.max(0, L) / 255, 1.6) * 255;     // 종이는 하얗게, 글자는 진하게
      if (mode === "bw") L = L > 170 ? 255 : 0;
      d[k] = d[k + 1] = d[k + 2] = L;
    } else { // 컬러 문서
      for (let c = 0; c < 3; c++){ let v = d[k + c] * f; v = v > 240 ? 255 : Math.pow(v / 255, 1.35) * 255; d[k + c] = v; }
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

DT.register({ id: "scan", group: "org", order: 6, name: "PDF로 스캔", desc: "카메라로 찍어 PDF 만들기", icon: I.scan,
  long: "휴대폰·노트북 카메라로 문서를 찍거나 사진을 올리면, 그림자와 누런 종이를 하얗게 보정해서 스캔한 것처럼 PDF로 만들어요.",
  mount(root){
    const st = DT.statusBox(), shots = [];
    let stream = null, filter = "color", pageSize = "a4";
    const video = h("video", { autoplay: true, playsinline: true, muted: true });
    const cam = h("div", { class: "cam hidden" }, video, h("button", { class: "shoot", type: "button", title: "찍기", onclick: shoot }));
    const camBtn = DT.button("📷 카메라 켜기", { onClick: toggleCam });
    const up = DT.dropZone({ accept: "image/*", hint: "또는 찍어 둔 사진을 올리세요 (휴대폰에서는 바로 촬영)", title: "사진 올리기 / 촬영", capture: null, onFiles: async fs => {
      for (const f of fs){ try{ shots.push({ canvas: await DT.imageToCanvas(f, 2600), rot: 0 }); }catch (e){ DT.toast(e.message, "err"); } }
      renderList();
    } });
    up.classList.add("small");
    const list = h("div", { class: "pgrid" });
    const fSeg = DT.seg([["color", "문서(컬러)"], ["gray", "문서(회색)"], ["bw", "흑백 선명"], ["orig", "원본 그대로"]], filter, v => { filter = v; renderList(); });
    const sSeg = DT.seg([["a4", "A4에 맞추기"], ["fit", "사진 크기 그대로"]], pageSize, v => pageSize = v);
    const go = DT.button("PDF로 저장", { primary: true, icon: DT.ICON.dl }); go.classList.add("big");
    go.onclick = () => DT.guard(st, async () => {
      if (!shots.length) throw new Error("먼저 사진을 찍거나 올려 주세요.");
      await DT.need("pdflib");
      const pdf = await PDFLib.PDFDocument.create();
      for (let i = 0; i < shots.length; i++){
        st.busy(`${i + 1}/${shots.length}쪽 보정 중…`); await DT.tick();
        const c = rotated(docFilter(shots[i].canvas, filter), shots[i].rot);
        const bytes = await DT.canvasBytes(c, "image/jpeg", .85), img = await pdf.embedJpg(bytes);
        if (pageSize === "a4"){
          const land = c.width > c.height, W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, m = 18;
          const k = Math.min((W - 2 * m) / c.width, (H - 2 * m) / c.height);
          pdf.addPage([W, H]).drawImage(img, { x: (W - c.width * k) / 2, y: (H - c.height * k) / 2, width: c.width * k, height: c.height * k });
        } else { const k = 72 / 200; pdf.addPage([c.width * k, c.height * k]).drawImage(img, { x: 0, y: 0, width: c.width * k, height: c.height * k }); }
      }
      const b = await pdf.save(); DT.save(b, `스캔_${DT.today()}.pdf`);
      st.ok(`${shots.length}쪽 스캔 PDF를 저장했어요 · ${DT.fmtSize(b.length)}`);
    });
    function rotated(c, rot){
      rot = ((rot % 360) + 360) % 360; if (!rot) return c;
      const o = document.createElement("canvas"), t = rot % 180 === 90;
      o.width = t ? c.height : c.width; o.height = t ? c.width : c.height;
      const g = o.getContext("2d"); g.translate(o.width / 2, o.height / 2); g.rotate(rot * Math.PI / 180); g.drawImage(c, -c.width / 2, -c.height / 2);
      return o;
    }
    function renderList(){
      list.innerHTML = "";
      if (!shots.length){ list.append(h("div", { class: "pgrid-empty" }, "찍은 페이지가 여기에 모여요.")); return; }
      shots.forEach((s, i) => {
        const prev = rotated(docFilter(small(s.canvas), filter), s.rot);
        const card = h("div", { class: "pcard" },
          h("div", { class: "pthumb" }, prev),
          h("div", { class: "ptools" },
            h("button", { type: "button", title: "돌리기", class: "acc", html: DT.ICON.rotR, onclick: () => { s.rot += 90; renderList(); } }),
            h("button", { type: "button", title: "앞으로", onclick: () => { if (i){ shots.splice(i - 1, 0, shots.splice(i, 1)[0]); renderList(); } } }, "◀"),
            h("button", { type: "button", title: "뒤로", onclick: () => { if (i < shots.length - 1){ shots.splice(i + 1, 0, shots.splice(i, 1)[0]); renderList(); } } }, "▶")),
          h("button", { type: "button", class: "px", onclick: () => { shots.splice(i, 1); renderList(); } }, "✕"),
          h("span", { class: "pnum" }, i + 1));
        const k = Math.min(1, 140 / Math.max(prev.width, prev.height));
        Object.assign(prev.style, { width: prev.width * k + "px", height: prev.height * k + "px", transform: "translate(-50%,-50%)" });
        list.append(card);
      });
    }
    function small(c){ if (c._small) return c._small; const k = 320 / Math.max(c.width, c.height); const o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return c._small = o; }
    async function toggleCam(){
      if (stream){ stop(); return; }
      try{
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        video.srcObject = stream; cam.classList.remove("hidden"); camBtn.innerHTML = "카메라 끄기";
      }catch (e){ DT.toast("카메라를 켤 수 없어요. 권한을 허용했는지 확인하거나 '사진 올리기'를 쓰세요.", "err"); }
    }
    function stop(){ if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; } cam.classList.add("hidden"); camBtn.innerHTML = "📷 카메라 켜기"; }
    function shoot(){
      if (!video.videoWidth) return;
      const c = document.createElement("canvas"); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0); shots.push({ canvas: c, rot: 0 }); renderList();
      cam.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 250 });
    }
    window.__dtCleanup.push(stop);
    renderList();
    root.append(h("div", { class: "row" }, camBtn, h("span", { class: "fmeta", style: { color: "var(--muted)", fontSize: "12.5px" } }, "문서를 화면에 꽉 차게, 밝은 곳에서 찍으면 가장 깨끗해요.")), cam, up,
      h("div", { class: "opts" }, DT.field("보정", fSeg), DT.field("페이지 크기", sSeg), go), list, st);
  } });
})();
