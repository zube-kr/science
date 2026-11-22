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
  const S = { unit: null, activity: null, session: null, student: null, items: new Map(), texts: new Map(), metas: new Map(), cards: new Map(), records: new Map(), base: null, bar: null, onLogin: null };

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
  .lms-meta{font-family:"Pretendard","Noto Sans KR",system-ui,sans-serif;border:2px solid #c4b5fd;background:linear-gradient(180deg,#faf7ff,#f3efff);border-radius:16px;padding:14px 16px;margin:16px 0;color:#1f2a44}
  .lms-meta .mh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
  .lms-meta .mh b{font-size:16px}
  .lms-meta .tag{font-size:11.5px;font-weight:800;padding:2px 9px;border-radius:999px;background:#ede9fe;color:#5b21b6}
  .lms-meta .mhint{font-size:12.5px;color:#6b5b95;margin-bottom:8px}
  .lms-meta .mq{margin:10px 0 4px;font-size:14px;font-weight:700;line-height:1.5}
  .lms-meta textarea{width:100%;min-height:64px;box-sizing:border-box;border:1.5px solid #d8ccfb;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:#fff;color:#1f2a44;resize:vertical}
  .lms-meta textarea[readonly]{background:#f4f1fb;color:#4b4370}
  .lms-meta .rate{display:flex;flex-wrap:wrap;gap:6px}
  .lms-meta .rate button{border:1.5px solid #d8ccfb;background:#fff;color:#3b2f6b;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer}
  .lms-meta .rate button.on{background:#7c3aed;border-color:#7c3aed;color:#fff}
  .lms-meta .rate button:disabled{cursor:default;opacity:.85}
  .lms-meta .ideas-in{display:flex;gap:6px}.lms-meta .ideas-in input{flex:1;border:1.5px solid #d8ccfb;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:#fff;color:#1f2a44}
  .lms-meta .ideas-in button,.lms-meta .rv button{border:1.5px solid #c4b5fd;background:#fff;color:#5b21b6;border-radius:10px;padding:6px 12px;font-weight:800;cursor:pointer;font-size:13px}
  .lms-meta .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
  .lms-meta .chips span{background:#ede9fe;color:#3b2f6b;border-radius:999px;padding:4px 6px 4px 12px;font-size:13.5px;display:inline-flex;align-items:center;gap:4px}
  .lms-meta .chips span button{all:unset;cursor:pointer;width:18px;height:18px;border-radius:50%;text-align:center;line-height:18px;color:#7c3aed}
  .lms-meta .rv{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-bottom:1px dashed #e4dafd;font-size:14px}
  .lms-meta .rv span.q{flex:1;min-width:180px}
  .lms-meta .rv button.on{background:#7c3aed;color:#fff;border-color:#7c3aed}
  .lms-meta .prev{font-size:13px;background:#fff;border:1px dashed #c4b5fd;border-radius:10px;padding:8px 10px;margin-top:6px;color:#4b4370;line-height:1.55}
  .lms-meta .mfoot{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
  .lms-meta .msave{border:0;border-radius:10px;padding:8px 16px;font-weight:800;font-size:14px;cursor:pointer;background:#7c3aed;color:#fff}
  .lms-meta .mstat{font-size:12.5px;color:#6b5b95}
  @media (prefers-color-scheme:dark){ .lms-meta{background:#211a3a;border-color:#4c3d8a;color:#ece8fb}.lms-meta .tag{background:#3b2d6b;color:#ddd3ff}.lms-meta .mhint,.lms-meta .mstat{color:#bfb3e8}.lms-meta textarea,.lms-meta .rate button,.lms-meta .prev{background:#151027;color:#ece8fb;border-color:#4c3d8a}.lms-meta textarea[readonly]{background:#1c1633} }
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
        if (!C.demo()){ const r = await C.apiGet({ action: "login", stu: sid, code }); name = r.name || ""; }
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

  /* ---------------- 메타질문 카드 ----------------
     LMS.meta(넣을 자리 요소, "before"|"during"|"after"|"extend", { position: "before"|"after" }) */
  function meta(anchor, stageKey, o = {}){
    const U = DB.UNITS[S.unit], st = DB.META_STAGES.find(x => x.key === stageKey);
    const qs = (((U && U.meta) || {})[stageKey] || []).filter(q => !o.only || o.only.includes(q.id));
    const cardKey = stageKey + (o.only ? ":" + o.only.join(",") : "");
    if (!qs.length || !st || !anchor) return;
    const box = el("div", { class: "lms-meta", "data-stage": stageKey });
    box.append(el("div", { class: "mh" }, el("b", {}, "🧠 메타질문 · " + st.name), el("span", { class: "tag" }, st.type)), el("div", { class: "mhint" }, st.hint));
    const vals = {}, ctrls = [];
    if (stageKey === "after"){        // 학습 전 내 생각을 다시 보여 주며 비교하게
      const prev = el("div", { class: "prev" }); box.append(prev);
      const show = () => {
        const all = {}; let qd = [];
        for (const [k, r] of S.metas) if (k.startsWith("before")){ Object.assign(all, r.vals); qd = qd.concat(r.qs); }
        const lines = qd.filter(q => filled(all[q.id])).map(q => q.id === "mb-main" ? "🔎 내 탐구 질문: " + all[q.id] : q.type === "rate" ? "자기평가: " + (DB.RATE.find(r => r.v === all[q.id]) || {}).name : q.type === "ideas" ? "내가 만든 질문: " + all[q.id].join(" / ") : "“" + all[q.id] + "”");
        if (!lines.length){ prev.style.display = "none"; return; }
        prev.style.display = ""; prev.innerHTML = "";
        prev.append(el("b", {}, "📌 학습 전 내 생각")); lines.forEach(t => prev.append(el("br"), t));
      };
      ctrls.push(show); show();
    }
    for (const q of qs){
      box.append(el("div", { class: "mq" }, q.q));
      if (q.type === "rate"){
        const row = el("div", { class: "rate" });
        DB.RATE.forEach(r => { const b = el("button", { type: "button" }, r.name); b.onclick = () => { if (b.disabled) return; vals[q.id] = r.v; [...row.children].forEach(x => x.classList.toggle("on", x === b)); }; row.append(b); });
        box.append(row);
      } else if (q.type === "ideas"){       // 여러 생각을 하나씩 늘어놓기 (발산적 사고)
        vals[q.id] = [];
        const inp = el("input", { type: "text", placeholder: "하나 쓰고 Enter (또는 '추가')", maxlength: 120 }), chips = el("div", { class: "chips" });
        const draw = () => { chips.innerHTML = ""; vals[q.id].forEach((t, i) => { const x = el("button", { type: "button", title: "지우기" }, "×"); x.onclick = () => { if (box.dataset.locked) return; vals[q.id].splice(i, 1); draw(); }; chips.append(el("span", {}, t, x)); }); };
        const add = () => { const t = inp.value.trim(); if (!t || box.dataset.locked) return; vals[q.id].push(t); inp.value = ""; draw(); inp.focus(); };
        inp.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); add(); } };
        box.append(el("div", { class: "ideas-in" }, inp, el("button", { type: "button", onclick: add }, "추가")), chips);
      } else if (q.type === "revisit"){      // 처음에 만든 내 질문 다시 보기
        const wrap = el("div"); box.append(wrap); const st = {}; let lastKey = null;
        const draw = force => {
          const mine = myQuestions(), key = JSON.stringify(mine);
          if (force !== true && key === lastKey) return;      // 질문 목록이 바뀔 때만 다시 그림(클릭이 사라지지 않게)
          lastKey = key; wrap.innerHTML = "";
          if (!mine.length){ wrap.append(el("div", { class: "mstat" }, "처음에 만든 질문이 없어요. 맨 위 '질문 만들기'에 질문을 적으면 여기에 나타나요.")); return; }
          mine.forEach(t => { const row = el("div", { class: "rv" }, el("span", { class: "q" }, "❓ " + t));
            ["해결됐다", "일부 해결", "아직 궁금"].forEach(lbl => { const b = el("button", { type: "button", class: st[t] === lbl ? "on" : "" }, lbl); b.onclick = () => { st[t] = lbl; vals[q.id] = Object.entries(st).map(([k, v]) => `${k} → ${v}`).join(" | "); draw(true); }; row.append(b); });
            wrap.append(row); });
        };
        ctrls.push(() => draw()); box.addEventListener("focusin", () => draw()); box.addEventListener("mouseenter", () => draw()); draw();
      } else {
        const ta = el("textarea", { placeholder: "내 생각을 자유롭게 적어 보세요." }); ta.oninput = () => { vals[q.id] = ta.value.trim(); }; box.append(ta);
      }
    }
    S.cards.set(cardKey, { stage: stageKey, qs, vals });          // 저장 버튼을 안 눌러도 제출할 때 함께 보냄
    const stat = el("span", { class: "mstat" }, stageKey === "before" ? "학습 전 생각은 저장하면 잠겨요. 나중에 '처음 생각'과 비교해요." : "");
    const save = el("button", { class: "msave", type: "button" }, "내 생각 저장");
    save.onclick = async () => {
      const ans = qs.filter(q => filled(vals[q.id]));
      if (!ans.length){ stat.textContent = "한 가지 이상 답해 주세요."; return; }
      const rec = { stage: stageKey, qs, vals: JSON.parse(JSON.stringify(vals)), ts: Date.now() }; S.metas.set(cardKey, rec);
      if (stageKey === "before"){ box.dataset.locked = "1"; box.querySelectorAll("textarea,input").forEach(t => t.readOnly = true); box.querySelectorAll(".rate button,.ideas-in button").forEach(b => b.disabled = true); save.style.display = "none"; }
      document.querySelectorAll(".lms-meta").forEach(a => a.__refresh && a.__refresh());
      const t = new Date(rec.ts), hm = `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
      if (!S.student){ stat.textContent = `✓ 저장했어요 (${hm}). 위에서 학습 기록을 연결하면 내 학습 성장에 남아요.`; return; }
      stat.textContent = "저장하는 중…";
      const pack = { sid: S.student.sid, code: S.student.code, rows: metaRows(rec) };
      try { await send(pack); stat.textContent = `✓ 내 학습 기록에 저장했어요 (${hm})`; }
      catch (e) { setQueue(queue().concat([pack])); stat.textContent = `✓ 저장했어요 (${hm}). 인터넷이 연결되면 기록으로 보낼게요.`; }
    };
    box.__refresh = () => ctrls.forEach(f => f());
    box.append(el("div", { class: "mfoot" }, save, stat));
    if (o.position === "after") anchor.after(box); else anchor.parentNode.insertBefore(box, anchor);
    return box;
  }
  const filled = v => Array.isArray(v) ? v.length > 0 : !!v;
  function myQuestions(){
    const out = [];
    for (const c of S.cards.values()) if (c.stage === "before") for (const q of c.qs) if (q.id === "mb-question" && Array.isArray(c.vals[q.id])) out.push(...c.vals[q.id]);
    return out;
  }
  function metaRows(rec){
    const st = S.student, ts = rec.ts;
    return rec.qs.filter(q => filled(rec.vals[q.id])).map(q => { const v = rec.vals[q.id]; return { ts, sid: st.sid, unit: S.unit, activity: S.activity, session: S.session, item: "meta:" + q.id, objectives: "", kind: "meta",
      correct: false, attempts: 1, level: q.type === "rate" ? v : Array.isArray(v) ? v.length : 0, confidence: 0, misconceptions: "",
      answer: String(q.type === "rate" ? (DB.RATE.find(r => r.v === v) || {}).name : Array.isArray(v) ? v.join(" | ") : v).slice(0, 800), aided: false }; });
  }
  function levelOf(it){
    if (!it.attempts) return 0;
    if (it.kind === "diag") return it.first ? 3 : 1;
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
    for (const card of S.cards.values()){ if (Object.values(card.vals).some(filled)) rows.push(...metaRows({ stage: card.stage, qs: card.qs, vals: { ...card.vals }, ts })); }
    for (const rc of S.records.values()){
      const v = rc.get(); if (!v || (!v.level && !v.answer)) continue;
      rows.push({ ts, sid: st.sid, unit: S.unit, activity: S.activity, session: S.session, item: rc.id, objectives: (rc.objectives || []).join(","), kind: rc.kind,
        correct: !!v.correct, attempts: 1, level: +v.level || 0, confidence: 0, misconceptions: "", answer: String(v.answer || "").slice(0, 800), aided: false });
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

  /* 문항이 아닌 기록(루브릭 자기평가, 체크리스트 등): get() → { level, answer, correct } */
  function record(id, o){ S.records.set(id, { id, kind: o.kind || "check", objectives: o.objectives || [], get: o.get }); }
  /* 이 화면에서 지금까지 푼 결과로 목표별 수준 계산 (즉시 피드백용) */
  function summary(){
    const byObj = {}, misc = new Set();
    for (const it of S.items.values()){
      if (!it.attempts || it.kind === "diag") continue;
      const r = { kind: it.kind, level: levelOf(it) };
      it.misc.forEach(m => misc.add(m));
      for (const o of it.objectives) (byObj[o] = byObj[o] || []).push(r);
    }
    const out = {}; for (const [o, list] of Object.entries(byObj)) out[o] = C.sessionLevel(list);
    return { levels: out, misc: [...misc] };
  }
  /* 재학습처럼 새 회차로 기록할 때 (앞 회차 문항은 비움) */
  function beginSession(suffix){
    S.session = S.base + suffix; S.items.clear(); S.texts.clear(); S.cards.clear(); S.records.clear();
  }
  function init(o){
    addCss();
    S.unit = o.unit; S.activity = o.activity; S.onLogin = o.onLogin || null;
    S.student = loadStudent();
    S.session = S.base = `${o.activity}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    S.bar = el("div", { class: "lms-bar" });
    if (o.mount) o.mount.parentNode.insertBefore(S.bar, o.mount); else document.body.prepend(S.bar);
    renderBar();
    if (S.student){ flushQueue(); if (S.onLogin) setTimeout(() => S.onLogin(S.student)); }
  }
  g.LMS = { init, item, text, meta, record, summary, beginSession, attempt, submit, state: S, levelOf };
})(window);
