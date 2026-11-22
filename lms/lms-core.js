/* =====================================================================
   학습 관리 공통 코어: 서버 통신 + 숙달 수준 계산
   (교사 대시보드, 학생 '내 학습', 워크시트가 함께 씁니다)
   ===================================================================== */
(function (g) {
  const DB = g.LMS_DB;
  const CFG = g.LMS_CONFIG || {};
  const LOCAL_KEY = "lms-local-records-v1";
  const DAY = 86400000;

  /* ---------------- 서버 통신 ---------------- */
  const demo = () => !CFG.apiUrl;
  async function apiGet(params){
    const u = new URL(CFG.apiUrl); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const r = await fetch(u.toString(), { redirect: "follow" });
    if (!r.ok) throw new Error("서버 응답 " + r.status);
    const j = await r.json(); if (!j.ok) throw Object.assign(new Error(j.error || "요청 실패"), { code: j.code }); return j;
  }
  async function apiPost(body){
    const r = await fetch(CFG.apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" });
    if (!r.ok) throw new Error("서버 응답 " + r.status);
    const j = await r.json(); if (!j.ok) throw Object.assign(new Error(j.error || "요청 실패"), { code: j.code }); return j;
  }
  function localRecords(){ try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch (e) { return []; } }
  function saveLocal(rows){ try { const a = localRecords().concat(rows); localStorage.setItem(LOCAL_KEY, JSON.stringify(a.slice(-5000))); } catch (e) {} }
  function clearLocal(){ try { localStorage.removeItem(LOCAL_KEY); } catch (e) {} }

  /* ---------------- 기록 정리 ---------------- */
  const sidOf = (grade, cls, num) => `${+grade}-${+cls}-${String(+num).padStart(2, "0")}`;
  function norm(r){
    const list = v => Array.isArray(v) ? v : String(v || "").split(",").map(s => s.trim()).filter(Boolean);
    return {
      ts: typeof r.ts === "number" ? r.ts : Date.parse(r.ts) || 0,
      sid: String(r.sid || ""), unit: r.unit || "", activity: r.activity || "", session: String(r.session || ""), item: String(r.item || ""),
      objectives: list(r.objectives), kind: r.kind || "core",
      correct: r.correct === true || r.correct === "TRUE" || r.correct === "true" || r.correct === 1,
      attempts: +r.attempts || 0, level: +r.level || 0, confidence: +r.confidence || 0,
      misconceptions: list(r.misconceptions), answer: r.answer == null ? "" : String(r.answer), aided: r.aided === true || r.aided === "TRUE" || r.aided === "true",
    };
  }
  /* 같은 (학생, 활동 회차, 문항)은 가장 마지막 기록만 */
  function dedupe(rows){
    const m = new Map();
    for (const r of rows){ const k = r.sid + "|" + r.session + "|" + r.item; const o = m.get(k); if (!o || r.ts >= o.ts) m.set(k, r); }
    return [...m.values()].sort((a, b) => a.ts - b.ts);
  }

  /* 한 회차(session)에서 한 목표의 수준:
     기본 문항 중 가장 낮은 수준 → 기본이 숙달(L3) 이상이면 전이 문항으로 L4까지 올라감 */
  function sessionLevel(items){
    const core = items.filter(r => r.kind === "core" && r.level > 0).map(r => r.level);
    const tr = items.filter(r => r.kind === "transfer" && r.level > 0).map(r => r.level);
    let lv = core.length ? Math.min(...core) : 0;
    if (tr.length){ if (lv >= 3) lv = Math.max(lv, Math.max(...tr)); else if (!lv) lv = Math.min(3, Math.min(...tr)); }
    return lv;
  }

  /* 학생 한 명의 단원 숙달 현황 */
  function studentMastery(rows, unitCode, now = Date.now()){
    const U = DB.UNITS[unitCode]; if (!U) return null;
    const out = {};
    for (const o of U.objectives){
      const ev = rows.filter(r => r.objectives.includes(o.code));
      const bySession = new Map();
      for (const r of ev){ if (r.kind === "teacher" || r.kind === "text") continue; (bySession.get(r.session) || bySession.set(r.session, []).get(r.session)).push(r); }
      const hist = [];
      for (const [s, items] of bySession){ const lv = sessionLevel(items); if (lv) hist.push({ ts: Math.max(...items.map(i => i.ts)), level: lv, by: items[0].activity, session: s, items }); }
      for (const r of ev) if (r.kind === "teacher" && r.level) hist.push({ ts: r.ts, level: r.level, by: "teacher", note: r.answer, items: [r] });
      hist.sort((a, b) => a.ts - b.ts);
      const cur = hist.length ? hist[hist.length - 1] : null;
      // 이 목표에 속한 오개념만 (오개념 목록에 연결 목표가 없으면 그대로)
      const misc = [...new Set(ev.flatMap(r => r.misconceptions))].filter(m => !DB.MISC[m] || DB.MISC[m].obj === o.code);
      const texts = ev.filter(r => r.kind === "text" && r.answer);
      // 간격 복습: 숙달(L3+) 횟수에 따라 3일 → 7일 → 21일 뒤 다시 확인
      const mastered = hist.filter(h => h.level >= 3);
      let reviewDue = null;
      if (cur && cur.level >= 3){ const gap = [3, 7, 21][Math.min(mastered.length, 3) - 1]; reviewDue = cur.ts + gap * DAY; }
      out[o.code] = { obj: o, level: cur ? cur.level : 0, hist, misc, texts, evidence: ev, reviewDue, due: reviewDue != null && now >= reviewDue,
        pendingText: texts.length > 0 && !hist.some(h => h.by === "teacher") };
    }
    return out;
  }
  /* 영역별 평균 수준(기록이 있는 목표만) */
  function areaProfile(mast){
    return DB.AREAS.map(a => {
      const ls = Object.values(mast).filter(m => m.obj.area === a.key && m.level > 0).map(m => m.level);
      return { area: a, level: ls.length ? ls.reduce((x, y) => x + y, 0) / ls.length : 0, n: ls.length };
    });
  }
  /* 반 전체 분석 */
  function classAnalysis(allRows, roster, unitCode){
    const U = DB.UNITS[unitCode];
    const rows = dedupe(allRows.map(norm)).filter(r => r.unit === unitCode || r.objectives.some(o => DB.OBJ[o] && DB.OBJ[o].unit === unitCode));
    const sids = [...new Set([...roster.map(s => s.sid), ...rows.map(r => r.sid)])].sort();
    const students = sids.map(sid => {
      const mine = rows.filter(r => r.sid === sid);
      const st = roster.find(s => s.sid === sid) || { sid };
      const mast = studentMastery(mine, unitCode);
      const lv = Object.values(mast).map(m => m.level);
      const done = lv.filter(l => l > 0).length, ok = lv.filter(l => l >= 3).length, low = lv.filter(l => l === 1).length;
      // 오개념이 드러난 '회차' 수 (한 워크시트 안 여러 문항은 1번으로 셈 → 2회차 이상이면 '반복')
      const miscSes = {}; for (const r of mine) for (const m of r.misconceptions) (miscSes[m] = miscSes[m] || new Set()).add(r.session);
      const miscCount = {}; for (const [m, set] of Object.entries(miscSes)) miscCount[m] = set.size;
      const meta = metaOf(mine, unitCode), rub = rubricOf(mine, unitCode, mast, meta), cyc = cycleOf(mine, meta, rub, mast);
      const avgLv = lv.filter(l => l > 0).length ? lv.filter(l => l > 0).reduce((a, b) => a + b, 0) / lv.filter(l => l > 0).length : 0;
      return { ...st, sid, rows: mine, mast, profile: areaProfile(mast), done, ok, low, miscCount, meta, rub, cyc, avgLv,
        confWrong: mine.filter(r => !r.correct && r.confidence >= 3 && r.kind !== "teacher" && r.kind !== "text"),
        lastTs: mine.length ? mine[mine.length - 1].ts : 0 };
    });
    const active = students.filter(s => s.rows.length);
    const objStats = U.objectives.map(o => {
      const ls = active.map(s => s.mast[o.code].level).filter(l => l > 0);
      return { obj: o, n: ls.length, ok: ls.filter(l => l >= 3).length, low: ls.filter(l => l <= 2).length, rate: ls.length ? ls.filter(l => l >= 3).length / ls.length : null };
    });
    const miscStats = Object.values(U.misconceptions || {}).map(m => ({ m, students: active.filter(s => s.miscCount[m.code]), repeat: active.filter(s => s.miscCount[m.code] >= 2) }))
      .filter(x => x.students.length).sort((a, b) => b.students.length - a.students.length);
    // 확신도 × 정답 4분면 (기본·전이 문항의 첫 판정 기준)
    const quad = { hc: 0, lc: 0, hw: 0, lw: 0 };
    for (const r of rows){ if (!r.confidence || r.kind === "teacher" || r.kind === "text") continue; const hi = r.confidence >= 3; if (r.correct) hi ? quad.hc++ : quad.lc++; else hi ? quad.hw++ : quad.lw++; }
    const allLv = active.flatMap(s => Object.values(s.mast).map(m => m.level).filter(l => l > 0));
    const kpi = {
      students: students.length, active: active.length,
      rate: allLv.length ? allLv.filter(l => l >= 3).length / allLv.length : null,
      mastered: active.filter(s => s.done && s.ok === U.objectives.length).length,
      needHelp: active.filter(s => s.low >= 3 || Object.values(s.miscCount).some(c => c >= 2)).length,
    };
    // 교사 알림
    const alerts = [];
    for (const os of objStats) if (os.low >= Math.max(3, Math.ceil(active.length * .3))) alerts.push({ kind: "obj", text: `'${os.obj.text}'에서 아직 숙달 전인 학생 ${os.low}명`, obj: os.obj.code, sids: active.filter(s => { const l = s.mast[os.obj.code].level; return l > 0 && l <= 2; }).map(s => s.sid) });
    const pair = (a, b) => active.filter(s => s.mast[a].level >= 3 && s.mast[b].level > 0 && s.mast[b].level <= 2);
    const P = U.objectives.map(o => o.code);
    if (P.length >= 5){ const x = pair(P[2], P[4]); if (x.length) alerts.push({ kind: "pair", text: `'${DB.OBJ[P[2]].text}' 숙달 · '${DB.OBJ[P[4]].text}' 아직 — 학생 ${x.length}명`, sids: x.map(s => s.sid) }); }
    const rep = active.filter(s => Object.values(s.miscCount).some(c => c >= 2));
    if (rep.length) alerts.push({ kind: "misc", text: `같은 오개념이 반복되는 학생 ${rep.length}명`, sids: rep.map(s => s.sid) });
    const cw = active.filter(s => s.confWrong.length);
    if (cw.length) alerts.push({ kind: "conf", text: `'오답인데 확신함' — 강한 오개념이 의심되는 학생 ${cw.length}명`, sids: cw.map(s => s.sid) });
    const pend = active.filter(s => Object.values(s.mast).some(m => m.pendingText));
    if (pend.length) alerts.push({ kind: "text", text: `서술형 답변이 교사 판정을 기다리는 학생 ${pend.length}명`, sids: pend.map(s => s.sid) });
    // 학습 순환 단계별 완료 학생 수
    const cycleStats = DB.CYCLE.map(c => ({ c, done: active.filter(s => s.cyc[c.key] === "done").length, partial: active.filter(s => s.cyc[c.key] === "partial").length }));
    // 메타인지 보정: 학습 후 자기평가와 실제 숙달 수준 비교
    const over = active.filter(s => s.meta.after >= 3 && s.avgLv > 0 && s.avgLv < 2.5);
    const under = active.filter(s => s.meta.after != null && s.meta.after <= 2 && s.avgLv >= 3);
    if (over.length) alerts.push({ kind: "over", text: `스스로는 잘 안다고 했지만(자기평가 3~4) 실제 숙달은 낮은 학생 ${over.length}명 — 메타인지 점검 필요`, sids: over.map(s => s.sid) });
    const rubWait = active.filter(s => s.cyc.activity === "done" && s.cyc.rubric !== "done");
    if (rubWait.length) alerts.push({ kind: "rubric", text: `학습 활동은 마쳤지만 루브릭 평가가 끝나지 않은 학생 ${rubWait.length}명`, sids: rubWait.map(s => s.sid) });
    const rubricStats = (U.rubric || []).map(c => {
      const ls = active.map(s => s.rub.find(x => x.c.key === c.key)).filter(x => x && x.show);
      const dist = [1, 2, 3, 4].map(l => ls.filter(x => x.show === l).length);
      return { c, n: ls.length, confirmed: ls.filter(x => x.confirmed).length, avg: ls.length ? ls.reduce((a, x) => a + x.show, 0) / ls.length : null, dist };
    });
    const withRate = active.filter(s => s.meta.before != null && s.meta.after != null);
    const metaStats = { stages: DB.META_STAGES.map(st => ({ st, done: active.filter(s => s.meta.stages.find(x => x.stage.key === st.key).done === "done").length })),
      rateBefore: withRate.length ? withRate.reduce((a, s) => a + s.meta.before, 0) / withRate.length : null,
      rateAfter: withRate.length ? withRate.reduce((a, s) => a + s.meta.after, 0) / withRate.length : null, nRate: withRate.length, over, under };
    return { unit: U, rows, students, active, objStats, miscStats, quad, kpi, alerts, cycleStats, rubricStats, metaStats };
  }
  /* ---------------- 메타질문 · 루브릭 · 학습 순환 ---------------- */
  const latest = (rows, item, kind) => { let o = null; for (const r of rows) if (r.item === item && (!kind || r.kind === kind) && (!o || r.ts >= o.ts)) o = r; return o; };
  /* 메타질문 답: 단계별 답, 학습 전·후 자기평가 */
  function metaOf(rows, unitCode){
    const U = DB.UNITS[unitCode], M = (U && U.meta) || {};
    const stages = DB.META_STAGES.map(st => {
      const items = (M[st.key] || []).map(q => { const r = latest(rows, "meta:" + q.id, "meta"); return { q, r, value: r ? (q.type === "rate" ? r.level : r.answer) : null, ts: r ? r.ts : 0 }; });
      const done = items.length > 0 && items.every(i => i.value) ? "done" : items.some(i => i.value) ? "partial" : "todo";
      return { stage: st, items, done };
    });
    const rateOf = key => { const st = stages.find(x => x.stage.key === key); const it = st && st.items.find(i => i.q.type === "rate" && i.value); return it ? +it.value : null; };
    const textLen = stages.flatMap(s => s.items).filter(i => i.q.type === "text" && i.value).map(i => String(i.value).length);
    return { stages, before: rateOf("before"), after: rateOf("after"), stagesDone: stages.filter(s => s.done === "done").length,
      stagesAny: stages.filter(s => s.done !== "todo").length, avgLen: textLen.length ? textLen.reduce((a, b) => a + b, 0) / textLen.length : 0, any: textLen.length > 0 };
  }
  /* 루브릭: 교사가 확정한 수준, 없으면 증거로 계산한 '제안 수준' */
  function rubricOf(rows, unitCode, mast, meta){
    const U = DB.UNITS[unitCode];
    return (U.rubric || []).map(c => {
      const conf = latest(rows, "rubric:" + c.key, "rubric");
      let sug = 0;
      if (c.meta){
        const change = meta.stages.find(s => s.stage.key === "after");
        const hasChange = change && change.items.some(i => i.q.type === "text" && i.value && String(i.value).length >= 15);
        sug = !meta.any ? (rows.some(r => r.kind === "core") ? 1 : 0) : meta.stagesDone >= 4 && hasChange && meta.avgLen >= 25 ? 4 : meta.stagesDone >= 3 ? 3 : meta.stagesAny >= 1 ? 2 : 1;
      } else {
        const ls = c.objectives.map(o => mast[o] ? mast[o].level : 0).filter(l => l > 0);
        if (ls.length) sug = Math.max(1, Math.min(4, Math.round(ls.reduce((a, b) => a + b, 0) / ls.length)));
      }
      return { c, level: conf ? conf.level : 0, suggested: sug, show: conf ? conf.level : sug, confirmed: !!conf, memo: conf ? conf.answer : "", ts: conf ? conf.ts : 0 };
    });
  }
  /* 학습 순환 진행 상태: 목표 → 활동 → 메타질문 → 루브릭 → 피드백·재학습 */
  function cycleOf(rows, meta, rub, mast){
    const act = rows.filter(r => r.kind === "core" || r.kind === "transfer");
    const fbRows = rows.filter(r => (r.kind === "teacher" || r.kind === "rubric") && r.answer);
    const lastFb = fbRows.length ? Math.max(...fbRows.map(r => r.ts)) : 0;
    const relearn = lastFb && act.some(r => r.ts > lastFb);
    const conf = rub.filter(x => x.confirmed).length;
    return {
      goal: "done",
      activity: act.length ? "done" : "todo",
      meta: meta.stagesDone >= 3 ? "done" : meta.stagesAny ? "partial" : "todo",
      rubric: rub.length && conf === rub.length ? "done" : conf ? "partial" : "todo",
      feedback: relearn ? "done" : lastFb ? "partial" : "todo",
      relearn, lastFb,
    };
  }

  /* 학생에게 추천할 다음 학습 */
  function nextSteps(mast){
    const list = Object.values(mast);
    const weak = list.filter(m => m.level > 0 && m.level <= 2).sort((a, b) => a.level - b.level);
    const none = list.filter(m => m.level === 0 && m.obj.area !== "design");
    const due = list.filter(m => m.due);
    const strong = list.filter(m => m.level >= 3);
    const path = weak.length >= 2 || list.some(m => m.level === 1) ? "basic" : strong.length >= Math.ceil(list.length * .7) ? "deep" : "core";
    return { weak, none, due, strong, path };
  }

  g.LMS_CORE = { DB, CFG, demo, metaOf, rubricOf, cycleOf, apiGet, apiPost, localRecords, saveLocal, clearLocal, sidOf, norm, dedupe, sessionLevel, studentMastery, areaProfile, classAnalysis, nextSteps, DAY };
})(window);
