(function () {
  const C = window.LMS_CORE, DB = C.DB;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY_LS = "lms-teacher-key";
  const ST = { source: null, roster: [], rows: [], A: null, sel: null, tab: "overview" };

  /* ---------- 기본 화면 ---------- */
  for (const [k, U] of Object.entries(DB.UNITS)) $("f-unit").insertAdjacentHTML("beforeend", `<option value="${k}">${esc(U.grade)}학년 · ${esc(U.title)}</option>`);
  try { $("f-key").value = localStorage.getItem(KEY_LS) || ""; } catch (e) {}
  if (C.demo()){
    $("key-box").classList.add("hidden");
    banner(`아직 서버(구글 시트)가 연결되지 않았어요. <b>⚙️ 처음 설정</b>을 따라 연결하면 반 전체 기록이 모여요. 지금은 <b>예시 데이터로 보기</b>로 둘러보거나, 시험 모드로 푼 워크시트 기록을 <b>이 기기 기록</b>으로 볼 수 있어요.`);
  }
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => showTab(b.dataset.tab));
  function showTab(t){ ST.tab = t; document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === t)); for (const s of ["overview", "student", "misc", "setup"]) $("t-" + s).classList.toggle("hidden", s !== t); }
  function banner(h){ const b = $("banner"); b.innerHTML = h; b.classList.toggle("hidden", !h); }
  function pill(t, cls){ const p = $("src-pill"); p.textContent = t; p.className = "pill " + (cls || ""); }
  const unit = () => $("f-unit").value;
  const lvBadge = l => `<span class="lv l${l}">${l ? "L" + l : "-"}</span>`;
  const fmtD = ts => { if (!ts) return ""; const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const stName = s => `${s.num || +s.sid.split("-")[2]}번${s.name ? " " + s.name : ""}`;

  /* ---------- 불러오기 ---------- */
  $("b-load").onclick = async () => {
    if (C.demo()) return loadLocal();
    const key = $("f-key").value.trim(); if (!key){ $("load-msg").textContent = "교사 비밀번호를 넣어 주세요."; return; }
    try { localStorage.setItem(KEY_LS, key); } catch (e) {}
    $("load-msg").textContent = "불러오는 중…";
    try {
      const r = await C.apiGet({ action: "class", key, grade: $("f-grade").value, cls: $("f-cls").value });
      ST.source = "server"; ST.roster = r.roster || []; ST.rows = r.rows || [];
      pill("구글 시트 연결됨", "ok"); $("load-msg").textContent = `학생 ${ST.roster.length}명 · 기록 ${ST.rows.length}줄을 불러왔어요 (${fmtD(Date.now())}).`;
      render();
    } catch (e) { $("load-msg").textContent = e.code === "key" ? "교사 비밀번호가 맞지 않아요." : "불러오지 못했어요: " + e.message; }
  };
  $("b-demo").onclick = () => { const d = makeDemo(); ST.source = "demo"; ST.roster = d.roster; ST.rows = d.rows; $("f-grade").value = 3; $("f-cls").value = 1; pill("예시 데이터 (가상)", "demo"); $("load-msg").textContent = "가상의 3학년 1반 28명 데이터예요. 실제 학생 기록이 아니에요."; render(); };
  $("b-local").onclick = loadLocal;
  function loadLocal(){
    const rows = C.localRecords(); const g = +$("f-grade").value, c = +$("f-cls").value;
    const mine = rows.filter(r => String(r.sid).startsWith(`${g}-${c}-`));
    ST.source = "local"; ST.rows = mine; ST.roster = [...new Set(mine.map(r => r.sid))].map(sid => ({ sid, grade: g, cls: c, num: +sid.split("-")[2], name: "" }));
    pill("이 기기 기록 (시험 모드)", "demo");
    $("load-msg").innerHTML = mine.length ? `이 기기에 저장된 ${g}학년 ${c}반 기록 ${mine.length}줄` : `이 기기에 ${g}학년 ${c}반 기록이 없어요. 워크시트를 시험 모드로 풀어 보거나 <b>예시 데이터로 보기</b>를 눌러 보세요.`;
    render();
  }
  $("f-unit").onchange = () => ST.source && render();

  /* ---------- 그리기 ---------- */
  function render(){
    const A = ST.A = C.classAnalysis(ST.rows, ST.roster, unit());
    renderOverview(A); renderStudentList(A); renderMisc(A);
    if (ST.sel && A.students.find(s => s.sid === ST.sel)) renderStudent(ST.sel); else $("stdetail").innerHTML = `<div class="card empty">왼쪽에서 학생을 고르세요.</div>`;
  }
  function renderOverview(A){
    const k = A.kpi, pct = v => v == null ? "-" : Math.round(v * 100) + "%";
    $("kpis").innerHTML = `
      <div class="card kpi"><small>전체 학생</small><b>${k.students}명</b><span>기록 있는 학생 ${k.active}명</span></div>
      <div class="card kpi good"><small>학습 목표 평균 달성률</small><b>${pct(k.rate)}</b><span>목표별 판정 중 L3 이상 비율</span></div>
      <div class="card kpi"><small>모든 목표 숙달 학생</small><b>${k.mastered}명</b><span>${A.unit.objectives.length}개 목표 모두 L3 이상</span></div>
      <div class="card kpi bad"><small>추가 지도 필요</small><b>${k.needHelp}명</b><span>미도달 3개 이상 · 같은 오개념 반복</span></div>`;
    $("objbars").innerHTML = A.objStats.map(o => {
      const r = o.rate, col = r == null ? "var(--l0)" : r >= .75 ? "#22a06b" : r >= .5 ? "#e08a1e" : "#d9534f";
      return `<div class="objbar" title="${esc(o.obj.code)} · ${esc(DB.area(o.obj.area).name)}"><div class="lbl"><em>${o.obj.no}</em>${esc(o.obj.text)}</div><div class="val">${r == null ? "-" : Math.round(r * 100) + "%"}</div><div class="track"><i style="width:${(r || 0) * 100}%;background:${col}"></i></div></div>`;
    }).join("");
    $("alerts").innerHTML = A.alerts.length ? A.alerts.map(a => `<div class="alert"><span class="ic">${{ obj: "📉", pair: "🔀", misc: "🔁", conf: "⚠️", text: "✍️" }[a.kind]}</span><div>${esc(a.text)}<div class="chips">${a.sids.slice(0, 30).map(sid => { const s = A.students.find(x => x.sid === sid); return `<button class="chip" data-sid="${sid}">${esc(stName(s))}</button>`; }).join("")}</div></div></div>`).join("") : `<div class="empty">아직 알림이 없어요.</div>`;
    $("legend").innerHTML = DB.LEVELS.map(l => `${lvBadge(l.lv)} ${esc(l.name)}`).join(" &nbsp; ");
    const objs = A.unit.objectives;
    $("heat").innerHTML = `<tr><th class="st">학생</th>${objs.map(o => `<th title="${esc(o.text)}">${o.no}<br><span class="muted" style="font-weight:600">${esc(DB.area(o.area).name)}</span></th>`).join("")}<th>숙달</th></tr>` +
      (A.students.length ? A.students.map(s => `<tr><td class="st" data-sid="${s.sid}">${esc(stName(s))}</td>${objs.map(o => { const m = s.mast[o.code]; return `<td><span class="lv l${m.level}" data-sid="${s.sid}" title="${esc(o.text)}${m.misc.length ? " · 오개념: " + m.misc.map(x => DB.MISC[x] ? DB.MISC[x].text : x).join(", ") : ""}">${m.level ? "L" + m.level : "-"}${m.misc.length ? "•" : ""}</span></td>`; }).join("")}<td class="sum">${s.ok}/${objs.length}</td></tr>`).join("") : `<tr><td colspan="${objs.length + 2}" class="empty">학생 기록이 없어요.</td></tr>`);
  }
  document.addEventListener("click", e => { const t = e.target.closest("[data-sid]"); if (t && !t.closest("#stlist")) { openStudent(t.dataset.sid); } });
  function openStudent(sid){ ST.sel = sid; showTab("student"); renderStudentList(ST.A); renderStudent(sid); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function renderStudentList(A){
    $("stlist").innerHTML = A.students.map(s => `<button class="stbtn ${s.sid === ST.sel ? "on" : ""}" data-pick="${s.sid}"><span>${esc(stName(s))}</span><span class="muted" style="font-size:12px">${s.rows.length ? s.ok + "/" + A.unit.objectives.length : "기록 없음"}</span></button>`).join("") || `<div class="empty">학생이 없어요.</div>`;
    $("stlist").querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { ST.sel = b.dataset.pick; renderStudentList(A); renderStudent(b.dataset.pick); });
  }

  /* 학생 한 명 */
  function renderStudent(sid){
    const A = ST.A, s = A.students.find(x => x.sid === sid); if (!s) return;
    const U = A.unit, steps = C.nextSteps(s.mast);
    // 영역별 수준 (4칸)
    const areas = s.profile.filter(p => U.objectives.some(o => o.area === p.area.key)).map(p => {
      const lv = Math.round(p.level), col = ["var(--l0)", "var(--l1)", "var(--l2)", "var(--l3)", "var(--l4)"][lv];
      return `<div class="area-row"><span>${esc(p.area.name)}</span><span class="dots">${[1, 2, 3, 4].map(i => `<i style="background:${i <= lv ? col : "var(--l0)"}"></i>`).join("")}</span></div>`;
    }).join("");
    // 성장 그래프: 회차별 평균 수준
    const pts = growthPoints(s);
    const objRows = U.objectives.map(o => {
      const m = s.mast[o.code];
      const misc = m.misc.map(x => `<div class="muted" style="font-size:12px">⚠️ ${esc(DB.MISC[x] ? DB.MISC[x].text : x)}</div>`).join("");
      const texts = m.texts.map(t => `<div class="note" style="margin-top:4px">✍️ ${esc((DB.item(t.activity, t.item) || {}).label || t.item)}<br>${esc(t.answer)}</div>`).join("");
      const ev = m.evidence.filter(r => r.kind === "core" || r.kind === "transfer").map(r => {
        const it = DB.item(r.activity, r.item);
        return `<div style="font-size:12px">${r.correct ? "✅" : "❌"} ${esc(it ? it.label : r.item)} ${r.kind === "transfer" ? '<span class="pill" style="padding:1px 6px">전이</span>' : ""} · 시도 ${r.attempts}번${r.confidence ? " · 확신 " + esc(DB.CONFIDENCE.find(c => c.v === r.confidence).name) : ""}${r.answer ? ` · <span class="muted">답: ${esc(r.answer)}</span>` : ""}</div>`;
      }).join("");
      const teach = m.hist.filter(h => h.by === "teacher").map(h => `<div style="font-size:12px">👩‍🏫 교사 판정 L${h.level} ${h.note ? "· " + esc(h.note) : ""} <span class="muted">${fmtD(h.ts)}</span></div>`).join("");
      return `<tr><td><b>${o.no}.</b> ${esc(o.text)}<div class="muted" style="font-size:11.5px">${esc(o.code)} · ${esc(DB.area(o.area).name)}${m.due ? " · 🔁 복습할 때" : ""}</div>${misc}</td>
        <td>${lvBadge(m.level)}${m.pendingText ? '<div class="pill" style="margin-top:4px">판정 대기</div>' : ""}</td>
        <td>${ev || '<span class="muted">-</span>'}${teach}${texts}
          <div class="bar-row" style="margin-top:6px"><select data-ov="${o.code}"><option value="">교사 판정…</option>${DB.LEVELS.slice(1).map(l => `<option value="${l.lv}">${l.short} ${esc(l.name)}</option>`).join("")}</select><input type="text" placeholder="메모(선택)" data-ovm="${o.code}" style="flex:1;min-width:110px"><button class="btn small" data-ovs="${o.code}">저장</button></div></td></tr>`;
    }).join("");
    const pathTxt = { basic: ["기초 보충 경로", "개념이 아직 부족한 목표부터 차근차근"], core: ["표준 경로", "약한 목표를 보완하고 확인 문제로 숙달 확인"], deep: ["심화 탐구 경로", "이미 숙달 — 실제 자료와 새로운 상황으로"] }[steps.path];
    const recs = (steps.path === "deep" ? steps.strong.slice(0, 3).map(m => m.obj.deep) : steps.weak.slice(0, 3).map(m => m.obj.basic)).concat(steps.due.slice(0, 2).map(m => `🔁 복습: ${m.obj.text}`));
    $("stdetail").innerHTML = `
      <div class="card"><div class="bar-row"><h2 style="margin:0">${esc(s.grade || sid.split("-")[0])}학년 ${esc(s.cls || sid.split("-")[1])}반 ${esc(stName(s))}</h2><span class="muted">${esc(U.title)} · 마지막 기록 ${fmtD(s.lastTs) || "없음"}</span><span class="grow"></span><span class="pill">숙달 ${s.ok}/${U.objectives.length}</span></div></div>
      <div class="grid g2e" style="margin-top:12px">
        <div class="card"><h2>영역별 학습 수준</h2>${areas}</div>
        <div class="card"><h2>최근 학습 변화 <small>회차별 평균 숙달 수준</small></h2>${growthSvg(pts)}</div>
      </div>
      <div class="path ${steps.path}" style="margin-top:12px"><h3>🧭 추천: ${pathTxt[0]} <span class="muted" style="font-weight:600">— ${pathTxt[1]}</span></h3>${recs.length ? `<ul>${recs.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : '<span class="muted">추천할 활동이 아직 없어요.</span>'}</div>
      <div class="card" style="margin-top:12px"><h2>학습 목표별 증거 <small>점수가 아니라 증거로 판정 · 서술형은 교사 판정으로 반영</small></h2>
        <div class="scroll"><table class="ev"><tr><th style="width:34%">학습 목표</th><th>수준</th><th>증거 · 교사 판정</th></tr>${objRows}</table></div></div>`;
    $("stdetail").querySelectorAll("[data-ovs]").forEach(b => b.onclick = () => saveOverride(sid, b.dataset.ovs));
  }
  function growthPoints(s){
    const m = new Map();
    for (const st of Object.values(s.mast)) for (const h of st.hist){ const k = h.by === "teacher" ? "t" + h.ts : h.session; const o = m.get(k) || { ts: h.ts, lv: [], by: h.by }; o.lv.push(h.level); o.ts = Math.max(o.ts, h.ts); m.set(k, o); }
    return [...m.values()].sort((a, b) => a.ts - b.ts).map(o => ({ ts: o.ts, v: o.lv.reduce((x, y) => x + y, 0) / o.lv.length, by: o.by }));
  }
  function growthSvg(pts){
    if (!pts.length) return `<div class="empty">아직 기록이 없어요.</div>`;
    const W = 460, H = 190, x0 = 34, y0 = 14, w = W - x0 - 14, h = H - y0 - 34;
    const X = i => x0 + (pts.length === 1 ? w / 2 : i / (pts.length - 1) * w), Y = v => y0 + h - (v / 4) * h;
    const name = p => p.by === "teacher" ? "교사 판정" : ((Object.values(DB.UNITS).flatMap(U => Object.entries(U.activities)).find(([k]) => k === p.by) || [0, { title: p.by }])[1].title);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%" role="img" aria-label="회차별 평균 숙달 수준">
      ${[1, 2, 3, 4].map(v => `<line x1="${x0}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${x0 - 8}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="var(--mute)">L${v}</text>`).join("")}
      <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${pts.map((p, i) => X(i) + "," + Y(p.v)).join(" ")}"/>
      ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4.5" fill="var(--accent)"><title>${esc(name(p))} ${fmtD(p.ts)}: 평균 L${p.v.toFixed(1)}</title></circle><text x="${X(i)}" y="${H - 14}" font-size="10.5" text-anchor="middle" fill="var(--soft)">${esc(name(p)).slice(0, 9)}</text><text x="${X(i)}" y="${H - 2}" font-size="10" text-anchor="middle" fill="var(--mute)">${new Date(p.ts).getMonth() + 1}/${new Date(p.ts).getDate()}</text>`).join("")}
    </svg>`;
  }
  async function saveOverride(sid, obj){
    const lv = +document.querySelector(`[data-ov="${obj}"]`).value; if (!lv){ alert("판정 수준을 골라 주세요."); return; }
    const memo = document.querySelector(`[data-ovm="${obj}"]`).value.trim(), ts = Date.now();
    const row = { ts, sid, unit: unit(), activity: "teacher", session: "teacher-" + ts, item: "teacher:" + obj, objectives: obj, kind: "teacher", correct: lv >= 3, attempts: 0, level: lv, confidence: 0, misconceptions: "", answer: memo, aided: false };
    try {
      if (ST.source === "server") await C.apiPost({ action: "teacher", key: $("f-key").value.trim(), rows: [row] });
      else if (ST.source === "local") C.saveLocal([row]);
      ST.rows.push(row); render(); renderStudent(sid);
    } catch (e) { alert("저장하지 못했어요: " + e.message); }
  }

  /* 오개념 · 확신도 */
  function renderMisc(A){
    const max = Math.max(1, ...A.miscStats.map(x => x.students.length));
    $("miscbars").innerHTML = A.miscStats.length ? A.miscStats.map(x => `<div class="objbar"><div class="lbl" title="${esc(x.m.text)}">${esc(x.m.text)}</div><div class="val">${x.students.length}명</div><div class="track"><i style="width:${x.students.length / max * 100}%;background:#8b5cf6"></i></div></div>
      <div class="muted" style="font-size:12px;margin:-2px 0 4px">관련 목표: ${esc(DB.OBJ[x.m.obj].text)}${x.repeat.length ? ` · <b style="color:var(--bad)">반복 ${x.repeat.length}명</b>` : ""} · 처방: ${esc(x.m.fix)}</div>
      <div class="chips" style="margin-bottom:10px">${x.students.map(s => `<button class="chip" data-sid="${s.sid}">${esc(stName(s))}</button>`).join("")}</div>`).join("") : `<div class="empty">발견된 오개념이 없어요.</div>`;
    const q = A.quad, tot = q.hc + q.lc + q.hw + q.lw || 1, p = v => Math.round(v / tot * 100) + "%";
    $("quad").innerHTML = `<div class="quad"><div></div><div class="h">정답</div><div class="h">오답</div>
      <div class="h">높은 확신</div><div class="c"><b>${q.hc}</b>${p(q.hc)} · 안정적인 이해 가능성</div><div class="c alarm"><b>${q.hw}</b>${p(q.hw)} · 강한 오개념 가능성 — 반드시 확인</div>
      <div class="h">낮은 확신</div><div class="c"><b>${q.lc}</b>${p(q.lc)} · 불안정한 이해, 추가 확인</div><div class="c"><b>${q.lw}</b>${p(q.lw)} · 개념 부족 또는 추측</div></div>
      <p class="muted" style="font-size:12.5px">정답률만 보면 놓치기 쉬운 '오답 + 높은 확신'을 따로 모아 아래에 보여 줘요.</p>`;
    const list = A.active.flatMap(s => s.confWrong.map(r => ({ s, r }))).sort((a, b) => b.r.ts - a.r.ts);
    $("confwrong").innerHTML = list.length ? `<div class="scroll"><table class="ev"><tr><th>학생</th><th>문항</th><th>학생 답</th><th>확신도</th><th>드러난 오개념</th></tr>${list.slice(0, 80).map(({ s, r }) => { const it = DB.item(r.activity, r.item); return `<tr><td><button class="chip" data-sid="${s.sid}">${esc(stName(s))}</button></td><td>${esc(it ? it.label : r.item)}</td><td>${esc(r.answer)}</td><td>${esc((DB.CONFIDENCE.find(c => c.v === r.confidence) || {}).name || "")}</td><td>${r.misconceptions.map(m => esc(DB.MISC[m] ? DB.MISC[m].text : m)).join("<br>")}</td></tr>`; }).join("")}</table></div>` : `<div class="empty">없어요.</div>`;
  }

  /* CSV */
  $("b-csv").onclick = () => {
    const A = ST.A; if (!A) return alert("먼저 데이터를 불러오세요.");
    const head = ["학년", "반", "번호", "이름", ...A.unit.objectives.map(o => `${o.no}.${o.text}`), "숙달 수", "오개념"];
    const lines = [head].concat(A.students.map(s => { const [g, c, n] = s.sid.split("-"); return [g, c, +n, s.name || "", ...A.unit.objectives.map(o => s.mast[o.code].level ? "L" + s.mast[o.code].level : ""), s.ok, Object.keys(s.miscCount).map(m => DB.MISC[m] ? DB.MISC[m].text : m).join(" / ")]; }));
    const csv = "﻿" + lines.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `학습성장_${$("f-grade").value}-${$("f-cls").value}_${A.unit.code}.csv`; a.click();
  };

  /* 설정 */
  fetch("code.gs").then(r => r.text()).then(t => { $("gs").textContent = t; }).catch(() => { $("gs").textContent = "code.gs 를 불러오지 못했어요. 저장소의 lms/code.gs 파일을 여세요."; });
  $("b-copy").onclick = async () => { try { await navigator.clipboard.writeText($("gs").textContent); $("b-copy").textContent = "복사됨!"; } catch (e) { alert("복사하지 못했어요. 직접 선택해서 복사해 주세요."); } };
  $("ping-url").value = C.CFG.apiUrl || "";
  $("b-ping").onclick = async () => {
    const u = $("ping-url").value.trim(); if (!u) return;
    $("ping-msg").textContent = "확인 중…";
    try { const r = await (await fetch(u + (u.includes("?") ? "&" : "?") + "action=ping")).json(); $("ping-msg").textContent = r.ok ? "✅ 연결됐어요! 이 주소를 config.js 에 넣으면 돼요." : "응답은 왔지만 학습 관리 서버가 아니에요."; }
    catch (e) { $("ping-msg").textContent = "❌ 연결하지 못했어요. 배포할 때 액세스를 '모든 사용자'로 했는지 확인하세요."; }
  };
  $("b-codes").onclick = async () => {
    if (C.demo()){ $("codes").innerHTML = `<div class="note">서버가 연결된 뒤에 쓸 수 있어요. (개인코드는 구글 시트 '학생' 시트에 있어요)</div>`; return; }
    try {
      const r = await C.apiGet({ action: "codes", key: $("f-key").value.trim(), grade: $("f-grade").value, cls: $("f-cls").value });
      const w = window.open("", "_blank");
      w.document.write(`<meta charset="utf-8"><title>개인코드 쪽지</title><style>body{font-family:sans-serif}.s{display:inline-block;width:31%;margin:1%;border:1px dashed #999;padding:10px;box-sizing:border-box}.s b{font-size:22px;letter-spacing:3px}</style>` +
        r.roster.map(s => `<div class="s">${s.grade}학년 ${s.cls}반 ${s.num}번 ${esc(s.name)}<br>개인코드 <b>${esc(s.code)}</b><br><small>과학 워크시트 위 '내 학습 기록 연결'에 입력하세요</small></div>`).join("") + `<script>print()<\/script>`);
    } catch (e) { $("codes").textContent = "불러오지 못했어요: " + e.message; }
  };

  /* ---------- 예시 데이터 (가상) ---------- */
  function makeDemo(){
    let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const names = ["김서연", "이도윤", "박하은", "최지호", "정민준", "강서아", "조예준", "윤지유", "장시우", "임수아", "한주원", "오하린", "서건우", "신채원", "권도현", "황지아", "안선우", "송다은", "전유준", "홍예린", "유시윤", "고은우", "문서진", "양지안", "손태윤", "배나윤", "백승민", "허소율"];
    const roster = names.map((name, i) => ({ sid: C.sidOf(3, 1, i + 1), grade: 3, cls: 1, num: i + 1, name }));
    const act = "parallax-ws", items = DB.UNITS["ASTRO-PARALLAX"].activities[act].items;
    const diff = { "exp-data": 1.2, concept1: 1.0, concept2: .3, xy: .8, q1: -.2, q2: -.6, "probe-move": .4, "draw-angle": -.1, limit: .2, "t-calc": -.8, "t-stereo": -.5 };
    const miscOf = { concept1: ["M-PLX-REVERSE"], concept2: ["M-PLX-INTERVAL", "M-PLX-REVERSE"], xy: ["M-PLX-REVERSE"], q1: ["M-PLX-HALF", "M-PLX-INTERVAL", "M-PLX-REVERSE"], q2: ["M-PLX-FORMULA"], "probe-move": ["M-PLX-STARMOVE", "M-PLX-VIEWPOINT"], "draw-angle": ["M-PLX-HALF"], limit: ["M-PLX-REVERSE"], "t-calc": ["M-PLX-FORMULA"], "t-stereo": ["M-PLX-REVERSE"] };
    const rows = [], now = Date.now(), sig = x => 1 / (1 + Math.exp(-x));
    roster.forEach((st, si) => {
      if (si === 27) return;                       // 한 명은 아직 기록 없음
      const ab = (R() + R() + R() - 1.5) * 2 + .9, rev = R() < .2;   // rev: 거리-시차를 반대로 아는 학생
      const sessions = R() < .45 ? 2 : 1;
      for (let k = 0; k < sessions; k++){
        const t0 = now - (sessions - k) * 4 * C.DAY - R() * C.DAY, session = `${act}-demo${si}-${k}`, gain = k * .9;
        for (const [id, it] of Object.entries(items)){
          if (it.kind === "text"){
            if (k === 0 && R() < .8) rows.push({ ts: t0 + 3e5, sid: st.sid, unit: "ASTRO-PARALLAX", activity: act, session, item: id, objectives: it.objectives.join(","), kind: "text", correct: false, attempts: 1, level: 0, confidence: 0, misconceptions: "", answer: id === "ex2AltMethod" ? "한쪽 눈으로 두 위치에서 번갈아 보며 빨대 끝이 가리키는 눈금을 비교한다." : "팔을 굽히면 물체가 눈에 가까워져서 두 눈으로 본 방향 차이가 커지기 때문이다.", aided: false });
            continue;
          }
          let p = sig(ab + gain + diff[id]); const relRev = rev && k === 0 && ["concept1", "xy", "t-stereo", "limit", "concept2"].includes(id);
          if (relRev) p *= .25;
          const first = R() < p, fin = first || R() < .6;
          const conf = first ? (R() < .75 ? 4 : 3) : (relRev && R() < .7 ? (R() < .5 ? 4 : 3) : 1 + (R() * 3 | 0));
          const mo = miscOf[id] || [];
          const ms = !fin ? [relRev ? "M-PLX-REVERSE" : mo[(R() * mo.length) | 0]].filter(Boolean) : (!first && mo.length && R() < .5 ? [mo[0]] : []);
          const lvl = first ? (it.kind === "transfer" ? 4 : 3) : fin ? (it.kind === "transfer" ? 3 : 2) : 1;
          rows.push({ ts: t0 + R() * 2e5, sid: st.sid, unit: "ASTRO-PARALLAX", activity: act, session, item: id, objectives: it.objectives.join(","), kind: it.kind, correct: fin, attempts: first ? 1 : 2 + (R() * 2 | 0), level: lvl, confidence: conf, misconceptions: (ms || []).join(","), answer: fin ? "정답" : ({ q2: "2", "t-calc": "0.1", concept1: "작아지고 / 커진다", "probe-move": "별이 실제로 움직여서" }[id] || "오답"), aided: false });
        }
      }
      if (R() < .35){ const ts = now - C.DAY; rows.push({ ts, sid: st.sid, unit: "ASTRO-PARALLAX", activity: "teacher", session: "teacher-" + ts, item: "teacher:ASTRO-PARALLAX-08", objectives: "ASTRO-PARALLAX-08", kind: "teacher", correct: true, attempts: 0, level: 3, confidence: 0, misconceptions: "", answer: "다른 방법 설계가 타당함", aided: false }); }
    });
    return { roster, rows };
  }
  window.__lmsTeacher = { ST, render, makeDemo };
})();
