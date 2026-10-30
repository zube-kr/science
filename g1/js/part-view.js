// KISPP 활동지 구간 보기
// 활동지 주소 뒤에 ?part=concept|lab|sim|quiz 를 붙이면 그 구간만 보여 줍니다.
//   concept 개념정리 · lab 탐구실험 · sim 시뮬레이션 · quiz 형성평가
// 구간은 <section class="card" data-part="concept quiz"> 처럼 직접 지정하고,
// 지정이 없으면 카드 제목(배지·제목 글자)으로 짐작합니다.
// &embed=1 을 함께 붙이면 다른 화면 안에 끼워 넣는 용도로 머리말을 숨기고 높이를 알려 줍니다.
// <body data-submit="full"> 인 활동지는 여러 구간의 답을 한 번에 제출하므로, 구간 보기에서는
// 학생 정보·제출 구간(data-part="submit")을 숨기고 "제출은 전체 워크시트에서"라고 안내합니다.
(function () {
  var PARTS = {
    concept: { name: "개념정리", icon: "📘" },
    lab: { name: "탐구실험", icon: "🧪" },
    sim: { name: "시뮬레이션", icon: "🕹️" },
    quiz: { name: "형성평가", icon: "✏️" }
  };
  // 순서가 중요: '실험 개요'는 개념, '가상실험'은 실험으로 보도록 위에서부터 검사
  var GUESS = [
    ["submit", /학생 정보/],
    ["quiz", /워크시트|점검|스스로 확인|사고력|제출|평가/],
    ["concept", /개념|배움|개요|읽기/],
    ["sim", /시뮬레이션|모형/],
    ["lab", /실험|탐구|관찰/]
  ];

  function partsOf(sec) {
    if (sec.dataset.part) return sec.dataset.part.split(/\s+/);
    var badge = sec.querySelector(".card-title .badge");
    var title = sec.querySelector(".card-title") || sec.querySelector("h2");
    var texts = [badge && badge.textContent, title && title.textContent];
    for (var t = 0; t < texts.length; t++) {
      if (!texts[t]) continue;
      for (var i = 0; i < GUESS.length; i++) if (GUESS[i][1].test(texts[t])) return [GUESS[i][0]];
    }
    return [];
  }
  window.KISPP_PARTS = PARTS;
  window.kisppPartsOf = partsOf;

  var params = new URLSearchParams(location.search);
  var part = params.get("part");
  if (!part || !PARTS[part]) return;
  var embed = params.get("embed") === "1";

  function apply() {
    var secs = document.querySelectorAll("section.card");
    if (!secs.length) secs = document.querySelectorAll("main section, .wrap section, body > section");
    var submitFull = document.body.dataset.submit === "full";
    var shown = 0;
    secs.forEach(function (s) {
      var ps = partsOf(s);
      // 제출 구간: 따로 제출할 수 있는 활동지에서만 형성평가와 함께 보여 줌
      var on = ps.indexOf("submit") >= 0 ? (!submitFull && part === "quiz") : ps.indexOf(part) >= 0;
      s.style.display = on ? "" : "none";
      if (on) shown++;
    });
    if (!shown) secs.forEach(function (s) { s.style.display = ""; }); // 해당 구간이 없으면 전체를 보여 줌

    var wrap = document.querySelector(".wrap") || document.querySelector("main") || document.body;
    if (embed) {
      // 끼워 넣기: 돌아가기 링크·머리말·꼬리말 숨기고, 높이를 바깥 화면에 알림
      var hide = document.querySelectorAll(".kispp-back, body > header, body > footer");
      hide = Array.prototype.slice.call(hide).concat(Array.prototype.slice.call(
        wrap.querySelectorAll(":scope > a, :scope > header, :scope > footer")));
      hide.forEach(function (el) { el.style.display = "none"; });
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
      var send = function () {
        parent.postMessage({ kisppFrame: params.get("frame"), height: document.documentElement.scrollHeight }, "*");
      };
      new ResizeObserver(send).observe(document.body);
      send();
      return;
    }
    var p = PARTS[part];
    var full = location.pathname.split("/").pop();
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;" +
      "background:#eef8e8;border:1px solid #cfe8c2;border-radius:12px;padding:10px 14px;margin:0 0 14px;" +
      "font:600 14px/1.4 Pretendard,'Noto Sans KR',sans-serif;color:#2c5e17";
    bar.innerHTML = "<span>" + p.icon + " 이 활동지의 <b>" + p.name + "</b> 부분만 보는 중이에요" +
      (shown ? "" : " (해당 부분이 없어 전체를 보여 줘요)") +
      (submitFull && shown ? " · 답안 제출은 전체 워크시트에서 할 수 있어요" : "") + "</span>" +
      '<a href="' + full + '" style="color:#1b2a8f;text-decoration:none;font-weight:700">전체 워크시트 보기 →</a>';
    var anchor = wrap.querySelector(":scope > header");
    wrap.insertBefore(bar, anchor ? anchor.nextSibling : wrap.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
