// 중학교 2학년 워크시트(g2/) 공통 설정
// 원래 KISPP 과학실(프놈펜한국국제학교)에서 만든 워크시트를 이 사이트로 가져와 쓰고 있어요.
window.KISPP_CONFIG = {
  // ▣ 학생 워크시트 답안을 받을 구글 Apps Script 웹 앱 주소
  //   이 사이트의 다른 워크시트(중1 g1/, 혈액의 구성 등)와 같은 스프레드시트 웹 앱(저장소 루트의 code.gs)을 씁니다.
  //   제출하면 워크시트 제목 이름의 탭에 한 줄씩 쌓입니다.
  SUBMIT_URL: "https://script.google.com/macros/s/AKfycbyGI9pOFAtmqsAjjA-jC0tQgg6jcJwzb1N0ZQw9JcZ9p_52RJOIROQr50nhqToK_X6t5Q/exec",
  GRADE_TAB: "중2",

  // ⑧ 별과 우주 워크시트는 답안을 JSON({ form, stuClass, stuNumber, name, '점수':'3/5', ... })으로 만들어요.
  // 루트 code.gs는 폼 형식(worksheet, grade, classNum, number, name, score, total, ...)만 읽으므로
  // 제출 직전에 이 형식으로 바꿔 보냅니다. 탭 이름은 "중2 Ⅷ 워크시트 제목"이 됩니다.
  toForm: function (p) {
    var out = new URLSearchParams();
    out.append("worksheet", "중2 Ⅷ " + (p.form || "별과 우주"));
    out.append("grade", "2");
    out.append("classNum", p.stuClass || "");
    out.append("number", p.stuNumber || "");
    out.append("name", p.name || "");
    var sc = String(p["점수"] || p.score || "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (sc) { out.append("score", sc[1]); out.append("total", sc[2]); }
    Object.keys(p).forEach(function (k) {
      if (["form", "stuClass", "stuNumber", "name", "점수", "score", "total", "grade", "worksheet", "classNum", "number"].indexOf(k) >= 0) return;
      var v = p[k];
      if (v === undefined || v === null) v = "";
      else if (typeof v === "object") v = JSON.stringify(v);
      out.append(k, String(v));
    });
    return out;
  }
  // 주소가 비어 있으면 화면에서 채점만 되고 스프레드시트로는 전송되지 않습니다.
};
