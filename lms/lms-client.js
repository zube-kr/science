/* =====================================================================
   워크시트용 학습 기록 도구 (LMS)
   사용법(워크시트 안):
     <script src="lms/config.js"></script><script src="lms/objectives.js"></script>
     <script src="lms/lms-core.js"></script><script src="lms/lms-client.js"></script>
     LMS.init({ unit: "ASTRO-PARALLAX", activity: "parallax-ws", mount: 요소 });
     LMS.item("문항id", { objectives: ["목표코드"], kind: "core"|"transfer", button: 정답확인버튼,
                         check: () => ({ correct, answer, misc: ["오개념코드"] }) 또는 null(아직 안 풂) });
     LMS.text("문항id", { objectives: [...], get: () => 서술형 글 });
     await LMS.submit();
   ===================================================================== */
(function (g) {
  const C = g.LMS_CORE, DB = C.DB;
  const BASE = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, "");
  const SKEY = "lms-student-v1", QKEY = "lms-queue-v1";
  const S = { unit: null, activity: null, session: null, student: null, items: new Map(), texts: new Map(), bar: null, onLogin: null };

  const css = `
  .lms-bar{font-family:"Pretendard","Noto Sans KR",system-ui,sans-serif;background:linear-gradient(135deg,#eef4ff,#f3efff);border:1.5px solid #c9d6f5;border-radius:16px;padding:12px 14px;margin:0 0 16px;color:#1f2a44}
  .lms-bar h4{margin:0 0 6px;font-size:15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .lms-bar h4 small{font-weight:600;color:#5b6787;font-size:12px}
  .lms-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .lms-row input{width:64px;padding:8px 9px;border:1.5px solid #c9d0e4;border-radius:10px;font-size:15px;background:#fff;color:#1f2a44}
  .lms-row input.code{width:92px;letter-spacing:2px}
  .lms-row label{font-size:12.5px;color:#5b6787;font-weight:700}
  .lms-btn{border:0;border-radius:10px;padding:9px 14px;font-weight:800;font-size:14px;cursor:pointer;background:#4f46e5;color:#fff}
  .lms-btn.ghost{background:#fff;color:#4f46e5;border:1.5px solid #c7c9f5}
  .lms-msg{font-size:13px;margin-top:6px;color:#5b6787}
  .lms-msg.err{color:#c0392b}.lms-msg.ok{color:#15803d}
  .lms-badge{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:#fff3cd;color:#8a6100}
  .lms-conf{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:10px 0 6px;font-family:"Pretendard",system-ui,sans-serif;font-size:12.5px;color:#5b6787}
  .lms-conf b{font-weight:800;margin-right:2px}
  .lms-conf button{border:1.5px solid #d4d8e8;background:#fff;color:#3b4563;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:700;cursor:pointer}
  .lms-conf button.on{background:#4f46e5;border-color:#4f46e5;color:#fff}
  .lms-conf.need{animation:lmsShake .4s}.lms-conf.need b{color:#c0392b}
  @keyframes lmsShake{0%,100%{transform:none}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
  .lms-hint{display:block;margin-top:6px;font-size:13px;line-height:1.55;color:#7c3aed;background:#f5f0ff;border-radius:10px;padding:7px 10px}
  @media (prefers-color-scheme:dark){ .lms-bar{background:#1b2340;border-color:#34406b;color:#e8ecfa}.lms-bar h4 small,.lms-msg,.lms-row label{color:#a9b4d6}.lms-row input{background:#111833;color:#fff;border-color:#3a4670}.lms-conf button{background:#111833;color:#dfe5f7;border-color:#3a4670}.lms-hint{background:#2a2147;color:#d6c8ff} }`;
  function addCss(){ if (document.getElementById("lms-css")) return; const s = document.createElement("style"); s.id = "lms-css"; s.textContent = css; document.head.appendChild(s); }
  const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === "class") e.className = v; else if (x.startsWith("on")) e[x] = v; else e.setAttribute(x, v); } k.flat().forEach(c => c != null && e.append(c)); return e; };

  /* ---------------- 로그인 막대 ---------------- */
  function loadStudent(){ try { return JSON.parse(sessionStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function saveStudent(s){ try { s ? sessionStorage.setItem(SKEY, JSON.stringify(s)) : sessionStorage.removeItem(SKEY); } catch (e) {} }
  function renderBar(){
    const b = S.bar; b.innerHTML = "";
    const mode = C.demo() ? el("span", { class: "lms-badge" }, "시험 모드 · 이 기기에만 저장") : null;
    if (S.student){
      const st = S.student;
      b.append(el("h4", {}, "📊 학습 기록 연결됨", mode),
        el("div", { class: "lms-row" }, el("span", {}, `${st.grade}학년 ${st.cls}반 ${st.num}번${st.name ? " " + st.name : ""} — 이 워크시트의 학습 결과가 내 학습 기록에 쌓여요.`)),
        el("div", { class: "lms-row", style: "margin-top:8px" },
          el("a", { class: "lms-btn ghost", href: BASE + "student.html", target: "_blank", style: "text-decoration:none" }, "내 학습 성장 보기"),
          el("button", { class: "lms-btn ghost", type: "button", onclick: () => { S.student = null; saveStudent(null); renderBar(); } }, "다른 학생으로 바꾸기")));
      return;
    }
    const f = { grade: el("input", { type: "number", min: 1, max: 3, inputmode: "numeric", placeholder: "학년", value: (DB.UNITS[S.unit] || {}).grade || "" }),
      cls: el("input", { type: "number", min: 1, inputmode: "numeric", placeholder: "반" }), num: el("input", { type: "number", min: 1, inputmode: "numeric", placeholder: "번호" }),
      code: el("input", { class: "code", type: "password", inputmode: "numeric", maxlength: 8, placeholder: "개인코드", autocomplete: "off" }) };
    const msg = el("div", { class: "lms-msg" }, C.demo() ? "선생님이 아직 서버를 연결하지 않아 시험 모드예요. 개인코드는 아무 숫자나 넣어도 돼요." : "선생님께 받은 개인코드를 넣으면, 문제를 풀 때마다 학습 목표별 성장 기록이 쌓여요.");
    const go = el("button", { class: "lms-btn", type: "button" }, "연결하기");
    go.onclick = async () => {
      const grade = +f.grade.value, cls = +f.cls.value, num = +f.num.value, code = f.code.value.trim();
      if (!grade || !cls || !num || !code){ msg.className = "lms-msg err"; msg.textContent = "학년, 반, 번호, 개인코드를 모두 넣어 주세요."; return; }
      const sid = C.sidOf(grade, cls, num);
      go.disabled = true; msg.className = "lms-msg"; msg.textContent = "확인하는 중…";
      try {
        let name = "";
        if (!C.demo()){ const r = await C.apiGet({ action: "login", sid, code }); name = r.name || ""; }
        S.student = { sid, grade, cls, num, code, name }; saveStudent(S.student); renderBar(); flushQueue();
        if (S.onLogin) S.onLogin(S.student);
      } catch (e) {
        go.disabled = false; msg.className = "lms-msg err";
        msg.textContent = e.code === "auth" ? "번호나 개인코드가 맞지 않아요. 다시 확인해 주세요." : "연결하지 못했어요(" + e.message + "). 인터넷을 확인하거나, 그냥 진행하면 제출할 때 다시 시도해요.";
      }
    };
    b.append(el("h4", {}, "📊 내 학습 기록 연결 ", el("small", {}, "학년·반·번호와 개인코드"), mode),
      el("div", { class: "lms-row" }, f.grade, el("label", {}, "학년"), f.cls, el("label", {}, "반"), f.num, el("label", {}, "번"), f.code, go), msg);
  }

  /* ---------------- 문항 ---------------- */
  function item(id, o){
    const it = { id, objectives: o.objectives || [], kind: o.kind || "core", check: o.check, attempts: 0, first: null, last: null, misc: new Set(), conf: 0, confAt: 0, hint: o.hint !== false };
    S.items.set(id, it);
    if (o.button){
      const btn = o.button, box = el("div", { class: "lms-conf" }, el("b", {}, "내 답에 얼마나 확신하나요?"));
      DB.CONFIDENCE.forEach(c => { const b = el("button", { type: "button" }, c.name); b.onclick = () => { it.conf = c.v; [...box.querySelectorAll("button")].forEach(x => x.classList.toggle("on", x === b)); box.classList.remove("need"); }; box.append(b); });
      btn.parentNode.insertBefore(box, btn);
      // 확신도를 먼저 고르게(답을 확인하기 전의 확신이 중요)
      btn.parentNode.addEventListener("click", e => {
        if (e.target.closest("button") !== btn || it.conf) return;
        e.stopImmediatePropagation(); e.preventDefault(); box.classList.remove("need"); void box.offsetWidth; box.classList.add("need");
      }, true);
      btn.addEventListener("click", () => { if (it.conf) attempt(id, btn); });
    }
    return it;
  }
  function attempt(id, btn){
    const it = S.items.get(id); if (!it || !it.check) return null;
    const r = it.check(); if (!r) return null;
    it.attempts++; if (it.first == null){ it.first = !!r.correct; it.confAt = it.conf; }
    it.last = r; (r.misc || []).forEach(m => it.misc.add(m));
    // 오개념이 보이면 바로 짧은 도움말
    if (btn && it.hint){
      let h = btn.parentNode.querySelector(`.lms-hint[data-for="${id}"]`);
      const tips = (r.misc || []).map(m => DB.MISC[m]).filter(Boolean);
      if (!r.correct && tips.length){ if (!h){ h = el("span", { class: "lms-hint", "data-for": id }); const res = btn.nextElementSibling && btn.nextElementSibling.classList.contains("check-result") ? btn.nextElementSibling : btn; res.after(h); } h.textContent = "💡 " + tips.map(t => t.fix).join(" "); }
      else if (h) h.remove();
    }
    return r;
  }
  function text(id, o){ S.texts.set(id, { id, objectives: o.objectives || [], get: o.get }); }
  function levelOf(it){
    if (!it.attempts) return 0;
    const fin = it.last && it.last.correct, tr = it.kind === "transfer";
    if (it.first) return tr ? 4 : 3;
    if (fin) return tr ? 3 : 2;
    return 1;
  }

  /* ---------------- 제출 ---------------- */
  function rowsNow(){
    const st = S.student, ts = Date.now(), rows = [];
    for (const it of S.items.values()){
      if (!it.attempts) attempt(it.id, null);       // 확인 버튼을 안 누른 문항은 제출 때 한 번 채점
      if (!it.attempts) continue;
      rows.push({ ts, sid: st.sid, unit: S.unit, activity: S.activity, session: S.session, item: it.id, objectives: it.objectives.join(","), kind: it.kind,
        correct: !!(it.last && it.last.correct), attempts: it.attempts, level: levelOf(it), confidence: it.confAt || it.conf || 0,
        misconceptions: [...it.misc].join(","), answer: String(it.last && it.last.answer != null ? it.last.answer : "").slice(0, 300), aided: false });
    }
    for (const t of S.texts.values()){
      const v = (t.get() || "").trim(); if (!v) continue;
      rows.push({ ts, sid: st.sid, unit: S.unit, activity: S.activity, session: S.session, item: t.id, objectives: t.objectives.join(","), kind: "text",
        correct: false, attempts: 1, level: 0, confidence: 0, misconceptions: "", answer: v.slice(0, 800), aided: false });
    }
    return rows;
  }
  function queue(){ try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch (e) { return []; } }
  function setQueue(q){ try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-50))); } catch (e) {} }
  async function send(pack){
    if (C.demo()){ C.saveLocal(pack.rows); return; }
    await C.apiPost({ action: "log", sid: pack.sid, code: pack.code, rows: pack.rows });
  }
  async function flushQueue(){
    const q = queue(); if (!q.length) return 0; const left = []; let n = 0;
    for (const p of q){ try { await send(p); n += p.rows.length; } catch (e) { left.push(p); } }
    setQueue(left); return n;
  }
  async function submit(){
    if (!S.student){ S.bar.scrollIntoView({ behavior: "smooth", block: "center" }); return { ok: false, reason: "login" }; }
    const rows = rowsNow(); if (!rows.length) return { ok: false, reason: "empty" };
    const pack = { sid: S.student.sid, code: S.student.code, rows };
    try { await send(pack); await flushQueue(); return { ok: true, n: rows.length, demo: C.demo() }; }
    catch (e) { setQueue(queue().concat([pack])); return { ok: false, reason: "network", queued: true, error: e.message }; }
  }

  function init(o){
    addCss();
    S.unit = o.unit; S.activity = o.activity; S.onLogin = o.onLogin || null;
    S.student = loadStudent();
    S.session = `${o.activity}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    S.bar = el("div", { class: "lms-bar" });
    if (o.mount) o.mount.parentNode.insertBefore(S.bar, o.mount); else document.body.prepend(S.bar);
    renderBar();
    if (S.student){ flushQueue(); if (S.onLogin) setTimeout(() => S.onLogin(S.student)); }
  }
  g.LMS = { init, item, text, attempt, submit, state: S, levelOf };
})(window);
