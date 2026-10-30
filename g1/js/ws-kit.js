// KISPP 과학실 · 시뮬레이션 워크시트 공통 채점·피드백·제출 (js/ws-kit.css와 함께 씀)
//
// 워크시트 HTML에 표시만 해 두면 이 파일이 채점하고 피드백을 보여 줍니다.
//   <span class="choice-group" data-key="q1" data-answer="청람색">  … <button class="choice-btn" data-value="청람색">
//   <span class="multi-group" data-key="q2" data-answer="ㄱ,ㄷ">     … <button class="multi-btn" data-value="ㄱ">   (있는 대로 고르기)
//   <input class="blank" data-key="q3" data-answer="규모|스케일">     글자 빈칸 (| 로 여러 정답)
//   <input class="blank" data-key="q4" data-num="1e-10" data-tol="0.05">  수 빈칸 (상대 오차 5%까지 정답, data-abs는 절대 오차)
//   <ol class="order-list" data-key="q5" data-answer="a,b,c"><li data-id="a">…</li></ol>   순서 맞추기
//   <textarea class="free" data-key="d1" data-keywords="단위,규모">  서술형 (점수 없음, 핵심어 피드백만)
// 문항 묶음 <div class="q" data-why="해설" data-hint="틀렸을 때 도움말"> 안에 <span class="fb"></span>이 피드백 자리입니다.
// 시뮬레이션 안의 값은 WS.custom(key, { value, check, answer, why, el })으로 직접 등록합니다.
//
// 각 카드(section.card)의 끝에 [확인하기] 버튼이 자동으로 붙어 그 카드만 바로 채점·피드백하고,
// data-part="submit" 카드의 [제출하고 채점받기]는 전체를 채점해 js/config.js의 SUBMIT_URL로 보냅니다.
(function () {
  var customs = {};
  var WS = { worksheet: document.title };
  window.WS = WS;

  // ── 값 맞추기 ─────────────────────────────────────────
  var SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "−": "-" };
  function plain(s) {
    return String(s == null ? "" : s).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻−]/g, function (c) { return SUP[c]; });
  }
  function norm(s) {
    return plain(s).toLowerCase().replace(/[\s·⋅∙*.\^()（）]/g, "").replace(/µ/g, "μ");
  }
  // "1×10^-10", "1x10-10", "1e-10", "10^-10", "0.0000000001", "46,250" 등을 수로 바꿈
  function toNumber(s) {
    var raw = String(s == null ? "" : s);
    var hasPow = /[\^⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(raw) || /[×xX*]\s*10/.test(raw); // 거듭제곱 표기가 있을 때만
    var t = plain(raw).replace(/[\s,]/g, "").replace(/[×xX*]/g, "x").replace(/\^/g, "");
    var m = hasPow && t.match(/^(?:([+-]?\d*\.?\d+)x)?10([+-]?\d+)$/);
    if (m) return (m[1] === undefined ? 1 : parseFloat(m[1])) * Math.pow(10, parseInt(m[2], 10));
    t = t.replace(/[^\d.eE+-]/g, "");
    if (!t) return NaN;
    var n = Number(t);
    return isNaN(n) ? parseFloat(t) : n;
  }
  WS.toNumber = toNumber;
  WS.norm = norm;
  function numOk(input, target, tol, abs) {
    var v = toNumber(input);
    if (isNaN(v)) return false;
    if (abs != null) return Math.abs(v - target) <= abs;
    if (target === 0) return Math.abs(v) <= (tol || 1e-9);
    return Math.abs(v - target) / Math.abs(target) <= (tol == null ? 0.02 : tol);
  }
  WS.numOk = numOk;

  // ── 문항 읽기 ─────────────────────────────────────────
  function items(root) {
    var out = [];
    (root || document).querySelectorAll("[data-key]").forEach(function (el) {
      if (el.closest("[data-part=submit]")) return;
      out.push({ key: el.dataset.key, el: el });
    });
    Object.keys(customs).forEach(function (k) {
      var c = customs[k];
      if (!root || root === document || (c.el && root.contains(c.el))) out.push({ key: k, el: c.el, custom: c });
    });
    return out;
  }

  function valueOf(it) {
    var el = it.el;
    if (it.custom) return String(it.custom.value() == null ? "" : it.custom.value());
    if (el.classList.contains("choice-group")) {
      var p = el.querySelector(".choice-btn.picked");
      return p ? p.dataset.value : "";
    }
    if (el.classList.contains("multi-group")) {
      return Array.prototype.map.call(el.querySelectorAll(".multi-btn.picked"), function (b) { return b.dataset.value; }).join(",");
    }
    if (el.classList.contains("order-list")) {
      return Array.prototype.map.call(el.children, function (li) { return li.dataset.id; }).join(",");
    }
    return (el.value || "").trim();
  }

  function isFree(it) { return !it.custom && it.el.tagName === "TEXTAREA"; }

  // 정답이면 true, 오답이면 false, 채점하지 않는 문항이면 null
  function check(it) {
    var el = it.el, v = valueOf(it);
    if (it.custom) return it.custom.check ? it.custom.check(v) : null;
    if (isFree(it)) return null;
    if (el.classList.contains("order-list")) return v === el.dataset.answer;
    if (el.classList.contains("multi-group")) {
      var a = el.dataset.answer.split(",").sort().join(","), b = v.split(",").filter(Boolean).sort().join(",");
      return a === b;
    }
    if (el.dataset.num != null) {
      return numOk(v, Number(el.dataset.num), el.dataset.tol != null ? Number(el.dataset.tol) : null,
        el.dataset.abs != null ? Number(el.dataset.abs) : null);
    }
    var nv = norm(v);
    if (!nv) return false;
    return el.dataset.answer.split("|").some(function (a) { return nv === norm(a); });
  }

  function answerText(it) {
    if (it.custom) return it.custom.answer || "";
    var el = it.el;
    if (el.dataset.show) return el.dataset.show;
    if (el.classList.contains("order-list")) {
      return el.dataset.answer.split(",").map(function (id) {
        var li = el.querySelector('[data-id="' + id + '"] .txt');
        return li ? li.textContent : id;
      }).join(" → ");
    }
    if (el.classList.contains("multi-group")) return el.dataset.answer.split(",").join(", ");
    if (el.dataset.num != null) return el.dataset.num;
    return el.dataset.answer.split("|")[0];
  }

  // ── 피드백 ───────────────────────────────────────────
  function fbOf(el) {
    var q = el && el.closest(".q");
    if (!q) return null;
    var fb = q.querySelector(".fb");
    if (!fb) { fb = document.createElement("span"); fb.className = "fb"; q.appendChild(fb); }
    return fb;
  }

  function markEl(it, ok) {
    var el = it.el;
    if (!el) return;
    if (el.tagName === "INPUT") { el.classList.toggle("ok", ok === true); el.classList.toggle("bad", ok === false); }
    if (el.classList && el.classList.contains("order-list")) {
      var ans = el.dataset.answer.split(",");
      Array.prototype.forEach.call(el.children, function (li, i) {
        li.classList.toggle("ok", li.dataset.id === ans[i]);
        li.classList.toggle("bad", li.dataset.id !== ans[i]);
      });
    }
  }

  function freeFeedback(it) {
    var v = valueOf(it), el = it.el, fb = fbOf(el);
    if (!fb) return;
    if (v.length < 5) { fb.className = "fb bad"; fb.innerHTML = "✏️ 아직 충분히 쓰지 않았어요. 자기 생각을 한두 문장으로 적어 보세요."; return; }
    var kw = (el.dataset.keywords || "").split(",").filter(Boolean);
    var hit = kw.filter(function (k) { return k.split("/").some(function (w) { return v.indexOf(w) >= 0; }); });
    var miss = kw.filter(function (k) { return hit.indexOf(k) < 0; });
    var html = "📝 잘 적었어요! ";
    if (kw.length) {
      html += hit.length ? "핵심어 <b>" + hit.map(function (k) { return k.split("/")[0]; }).join(", ") + "</b>을(를) 사용했어요. " : "";
      if (miss.length) html += "<span class='why'>💡 더 생각해 보기: '" + miss.map(function (k) { return k.split("/")[0]; }).join("', '") + "'과(와) 연결해서 설명하면 더 좋아요.</span>";
    }
    if (el.dataset.model) html += "<span class='why'>예시 답안: " + el.dataset.model + "</span>";
    fb.className = "fb info";
    fb.innerHTML = html;
  }

  // 한 .q 안의 문항들을 모아 피드백 한 줄로 보여 줌
  function grade(root) {
    var list = items(root), groups = new Map(), score = 0, total = 0, empty = 0;
    list.forEach(function (it) {
      if (isFree(it)) { freeFeedback(it); return; }
      var ok = check(it);
      if (ok === null) return;
      total++;
      if (ok) score++;
      if (valueOf(it) === "") empty++;
      markEl(it, ok);
      var q = it.el && it.el.closest(".q");
      var key = q || it.el;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ it: it, ok: ok });
    });
    groups.forEach(function (arr, q) {
      var fb = fbOf(arr[0].it.el);
      if (!fb) return;
      var bad = arr.filter(function (x) { return !x.ok; });
      var why = (q.dataset && q.dataset.why) || "";
      var hint = (q.dataset && q.dataset.hint) || "";
      var cw = arr.map(function (x) { return x.it.custom && x.it.custom.why; }).filter(Boolean).join(" ");
      if (!bad.length) {
        fb.className = "fb ok";
        fb.innerHTML = "✅ 정답이에요!" + (why || cw ? "<span class='why'>" + (why || cw) + "</span>" : "");
      } else {
        var lines = bad.map(function (x) {
          var label = (x.it.el && x.it.el.dataset && x.it.el.dataset.label) || "";
          return (label ? label + ": " : "") + answerText(x.it);
        });
        fb.className = "fb bad";
        fb.innerHTML = (arr.length > 1 ? "❌ " + (arr.length - bad.length) + " / " + arr.length + " 맞았어요. " : "❌ 다시 생각해 보세요. ") +
          "정답 → " + lines.join(" · ") +
          (hint || why || cw ? "<span class='why'>💡 " + (hint || why || cw) + "</span>" : "");
      }
    });
    return { score: score, total: total, empty: empty };
  }
  WS.grade = grade;

  function clearMarks(root) {
    (root || document).querySelectorAll(".fb").forEach(function (f) { f.className = "fb"; f.innerHTML = ""; });
    (root || document).querySelectorAll("input.blank").forEach(function (i) { i.classList.remove("ok", "bad"); });
    (root || document).querySelectorAll(".order-list li").forEach(function (li) { li.classList.remove("ok", "bad"); });
  }
  WS.clearMarks = clearMarks;

  // ── 시뮬레이션 값 등록 ────────────────────────────────
  WS.custom = function (key, c) { customs[key] = c; };

  // ── 조작 ─────────────────────────────────────────────
  function wireChoices() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".choice-btn");
      if (b) {
        var g = b.closest(".choice-group");
        g.querySelectorAll(".choice-btn").forEach(function (x) { x.classList.toggle("picked", x === b); });
        return;
      }
      var m = e.target.closest(".multi-btn");
      if (m) m.classList.toggle("picked");
    });
  }

  function wireOrder(list) {
    var renum = function () {
      Array.prototype.forEach.call(list.children, function (li, i) {
        var o = li.querySelector(".ord"); if (o) o.textContent = i + 1;
        li.classList.remove("ok", "bad");
      });
    };
    Array.prototype.forEach.call(list.children, function (li) {
      if (!li.querySelector(".txt")) li.innerHTML = '<span class="txt">' + li.innerHTML + "</span>";
      li.insertAdjacentHTML("afterbegin", '<span class="ord"></span>');
      li.insertAdjacentHTML("beforeend", '<button type="button" class="mv" data-d="-1" aria-label="위로">▲</button><button type="button" class="mv" data-d="1" aria-label="아래로">▼</button>');
      li.draggable = true;
      li.addEventListener("dragstart", function () { li.classList.add("dragging"); });
      li.addEventListener("dragend", function () { li.classList.remove("dragging"); renum(); });
    });
    list.addEventListener("dragover", function (e) {
      e.preventDefault();
      var drag = list.querySelector(".dragging"); if (!drag) return;
      var after = Array.prototype.filter.call(list.children, function (c) { return c !== drag; })
        .find(function (c) { var r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (after) list.insertBefore(drag, after); else list.appendChild(drag);
    });
    list.addEventListener("click", function (e) {
      var b = e.target.closest(".mv"); if (!b) return;
      var li = b.closest("li"), d = Number(b.dataset.d);
      if (d < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      if (d > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      renum();
    });
    renum();
  }

  function addCheckRows() {
    document.querySelectorAll("section.card").forEach(function (sec) {
      if (sec.dataset.part === "submit" || sec.hasAttribute("data-nocheck")) return;
      if (!items(sec).length) return;
      var row = document.createElement("div");
      row.className = "check-row";
      row.innerHTML = '<button type="button" class="btn main small">확인하기</button><span class="score"></span>';
      sec.appendChild(row);
      var out = row.querySelector(".score");
      row.querySelector("button").addEventListener("click", function () {
        var r = grade(sec);
        if (!r.total) { out.textContent = "피드백을 확인해 보세요."; out.className = "score"; return; }
        out.textContent = r.score + " / " + r.total + " 정답" + (r.empty ? " · 빈칸 " + r.empty + "개" : "") +
          (r.score === r.total ? " 🎉 모두 맞았어요!" : " · 틀린 문항의 해설을 읽고 다시 고쳐 보세요.");
        out.className = "score" + (r.score === r.total ? " ok" : "");
      });
    });
  }

  // ── 제출 ─────────────────────────────────────────────
  function wireSubmit() {
    var btn = document.getElementById("ws-submit");
    if (!btn) return;
    var status = document.getElementById("ws-status");
    var result = document.getElementById("ws-result");
    btn.addEventListener("click", async function () {
      var get = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; };
      var name = get("ws-name");
      if (!name) { alert("이름을 입력해 주세요."); return; }
      var r = grade(document);
      document.querySelectorAll("section.card .check-row .score").forEach(function (s) { s.textContent = ""; });
      if (r.empty && !confirm("아직 답하지 않은 문항이 " + r.empty + "개 있어요. 그래도 제출할까요?")) return;

      var payload = {
        worksheet: WS.worksheet, grade: get("ws-grade"), classNum: get("ws-class"), number: get("ws-number"), name: name,
        score: String(r.score), total: String(r.total)
      };
      items(document).forEach(function (it) {
        var v = valueOf(it), ok = check(it);
        payload[it.key] = v + (ok === true ? " (O)" : ok === false ? " (X)" : "");
      });
      if (result) {
        result.textContent = r.score + " / " + r.total + " 정답";
        result.className = "score" + (r.score === r.total ? " ok" : "");
      }
      showSummary();

      var url = (window.KISPP_CONFIG && window.KISPP_CONFIG.SUBMIT_URL) || "";
      if (!url) { status.textContent = "채점 완료! (스프레드시트 주소가 설정되지 않아 결과는 저장되지 않았어요.)"; return; }
      btn.disabled = true;
      status.textContent = "제출 중...";
      try {
        await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(payload) });
        status.textContent = "채점 완료! 선생님 스프레드시트에 답안이 전송되었어요. 위의 피드백을 읽고 틀린 부분을 다시 확인해 보세요.";
      } catch (err) {
        status.textContent = "채점은 끝났지만 전송에 실패했어요. 인터넷 연결을 확인하고 다시 제출해 주세요.";
      } finally { btn.disabled = false; }
    });
    var reset = document.getElementById("ws-reset");
    if (reset) reset.addEventListener("click", function () {
      if (!confirm("모든 답을 지우고 처음부터 다시 풀까요?")) return;
      location.reload();
    });
  }

  function showSummary() {
    var box = document.getElementById("ws-summary");
    if (!box) return;
    box.innerHTML = "";
    document.querySelectorAll("section.card").forEach(function (sec) {
      if (sec.dataset.part === "submit") return;
      var list = items(sec).filter(function (it) { return !isFree(it) && check(it) !== null; });
      if (!list.length) return;
      var ok = list.filter(function (it) { return check(it); }).length;
      var t = sec.querySelector(".card-title");
      if (t) { t = t.cloneNode(true); t.querySelectorAll(".badge").forEach(function (b) { b.remove(); }); }
      var name = t ? t.textContent.replace(/\s+/g, " ").trim() : "";
      var d = document.createElement("div");
      d.innerHTML = "<b style='color:" + (ok === list.length ? "var(--ok)" : "var(--warm)") + "'>" + ok + " / " + list.length + "</b>" + name;
      box.appendChild(d);
    });
  }

  function start() {
    wireChoices();
    document.querySelectorAll(".order-list").forEach(wireOrder);
    addCheckRows();
    wireSubmit();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
