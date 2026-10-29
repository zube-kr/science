/**
 * 아화중학교 3학년 과학 워크시트 - 답안 저장용 Apps Script
 * (스프레드시트 이름: 아화중_중3_워크시트)
 *
 * 3학년 워크시트(시차 측정하기, 별의 밝기, 별의 색, 은하수와 우리은하,
 * 성단과 성운, 팽창하는 우주, 우주 탐사 등)의 제출을 하나의 배포/스프레드시트로 받아서,
 * 워크시트별로 별도의 시트(탭)에 저장합니다.
 *
 * ▣ 새 워크시트를 추가할 때 이 코드를 고칠 필요가 없습니다.
 * 워크시트가 보내는 payload에 form: "고유이름" 값만 넣으면, 그 이름의 시트
 * 탭이 자동으로 만들어지고 payload에 담긴 필드가 그대로(적은 순서 그대로)
 * 열로 기록됩니다. 나중에 문항을 추가해 필드가 늘어나도 "교사피드백" 열
 * 앞에 새 열이 자동으로 끼워집니다. (반/번호/이름은 항상 맨 앞, 교사피드백은
 * 항상 맨 뒤에 고정됩니다.)
 *
 * 시차/밝기/별색/은하 워크시트는 아래 FORMS 객체에 한글로 다듬은 열 이름이
 * 등록되어 있습니다. 등록하지 않은 워크시트는 payload의 필드 이름이 그대로
 * 열 제목으로 쓰이며 정상 동작합니다.
 *
 * [설치 방법]
 * 1. 새 Google 스프레드시트를 만들고 이름을 "아화중_중3_워크시트"로 정한다.
 * 2. 메뉴 [확장 프로그램] > [Apps Script]를 연다.
 * 3. 기본 코드를 지우고 이 파일 내용 전체를 붙여넣고 저장한다.
 * 4. 상단 [배포] > [새 배포] > 톱니바퀴에서 유형: "웹 앱" 선택
 *    - 실행 계정: 나(본인)
 *    - 액세스 권한이 있는 사용자: 모든 사용자 (익명 학생 접속 허용용)
 * 5. 처음 배포 시 Google이 권한 승인을 요구하면 승인한다.
 *    ("확인되지 않은 앱" 화면이 나오면 [고급] > [(프로젝트 이름)(으)로 이동] > [허용])
 * 6. 배포 후 나오는 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 복사한다.
 *    이 URL 하나를 3학년 워크시트 HTML 파일들이 함께 사용한다.
 *
 * [AI 조사 도우미(Gemini) 설정 — 우주 탐사 워크시트용, 선택 사항]
 * 1. https://aistudio.google.com 에서 무료 API 키를 만든다.
 * 2. Apps Script 왼쪽 [프로젝트 설정(톱니바퀴)] > [스크립트 속성] > [스크립트 속성 추가]
 *    - 속성: GEMINI_API_KEY   값: 방금 만든 키
 *    - GEMINI_MODEL(사용할 모델), GEMINI_SEARCH(구글 검색 출처 on/off)는 testGemini 가 자동으로 정해 준다.
 * 3. 편집기 위쪽 함수 목록에서 testGemini 를 고르고 [실행] → 권한 승인 창이 뜨면 승인한다.
 *    (외부 서비스 호출 권한을 처음 한 번 승인해야 웹 앱이 동작한다. testGemini 는 하루 한도가 큰
 *     Flash Lite 모델을 우선으로, 10초 안에 답하는 모델을 골라 GEMINI_MODEL 에 저장해 준다.
 *     실행 로그에 "설정 완료"가 보이면 OK)
 * 4. [배포] > [배포 관리] > 연필 아이콘 > 버전: "새 버전" > [배포]  (URL은 그대로 유지)
 * 키는 이 스크립트 안에만 저장되므로 워크시트(공개 웹페이지)에는 드러나지 않는다.
 * 학생 질문과 답변 요약은 "AI조사_기록" 시트에 남는다.
 */

const FORMS = {
  parallax: {
    sheetName: "답안",
    header: ["제출시각", "반", "번호", "이름",
             "팔폄-오른쪽눈", "팔폄-왼쪽눈",
             "팔굽힘-오른쪽눈", "팔굽힘-왼쪽눈",
             "서술형답변",
             "심화-가(굽힘)오른쪽눈", "심화-가(굽힘)왼쪽눈",
             "심화-나(폄)오른쪽눈", "심화-나(폄)왼쪽눈",
             "심화-시차비교설명", "심화-대안측정방법",
             "개념-가까울수록", "개념-멀수록", "개념-거리단어",
             "개념-개월수", "개념-pc값", "개념-관계①", "개념-관계②",
             "XY-연주시차비교", "XY-거리비교",
             "문제1-선택", "문제2-거리(pc)",
             "교사피드백"],
    row: function (data) {
      return [
        data.extendRight || "", data.extendLeft || "",
        data.bentRight || "", data.bentLeft || "",
        data.reflection || "",
        data.ex2BentRight || "", data.ex2BentLeft || "",
        data.ex2ExtendRight || "", data.ex2ExtendLeft || "",
        data.ex2Reason || "", data.ex2AltMethod || "",
        data.blankClose || "", data.blankFar || "", data.blankDistanceWord || "",
        data.blankMonths || "", data.blankPc || "", data.blankRel1 || "", data.blankRel2 || "",
        data.blankParallaxCompare || "", data.blankDistanceCompare || "",
        data.q1Selected || "", data.starADistance || ""
      ];
    }
  },
  brightness: {
    sheetName: "밝기_답안",
    header: ["제출시각", "반", "번호", "이름",
             "거리(한칸,cm)", "거리(네칸,cm)", "거리(아홉칸,cm)",
             "넓이-거리관계", "밝기-거리관계",
             "확인문제1-선택", "확인문제2-선택",
             "개념-1등급", "개념-6등급", "개념-100배", "개념-2.5배", "개념-10pc",
             "OX1", "OX2", "OX3",
             "겉보기밝기순서", "실제밝기순서", "드래그시뮬최종상태",
             "큰개자리-4.1", "큰개자리-2.0", "큰개자리--1.4",
             "아두이노-측정데이터", "아두이노-거리지수(n)", "아두이노-생각해보기",
             "교사피드백"],
    row: function (data) {
      return [
        data.distOne || "", data.distFour || "", data.distNine || "",
        data.areaDistanceRelation || "", data.brightnessRelation || "",
        data.q1Selected || "", data.q2Selected || "",
        data.magBright || "", data.magDim || "", data.mag100x || "", data.mag25x || "", data.magPcDef || "",
        data.ox1 || "", data.ox2 || "", data.ox3 || "",
        data.apparentOrder || "", data.realOrder || "", data.dragFinalState || "",
        data.caniMatch41 || "", data.caniMatch20 || "", data.caniMatchNeg14 || "",
        data.arduinoData || "", data.arduinoExponent || "", data.arduinoReflection || ""
      ];
    }
  },
  starcolor: {
    sheetName: "별색_답안",
    header: ["제출시각", "반", "번호", "이름",
             "별온도순서", "온도색비교설명",
             "HR정리-반지름효과", "HR정리-온도효과",
             "개념-고온색", "개념-저온색",
             "확인문제1-선택", "확인문제2-선택", "확인문제3-선택",
             "OX1", "OX2", "OX3",
             "교사피드백"],
    row: function (data) {
      return [
        data.starOrder || "", data.starCompareReason || "",
        data.hrRadiusEffect || "", data.hrTempEffect || "",
        data.hotColor || "", data.coldColor || "",
        data.q1Selected || "", data.q2Selected || "", data.q3Selected || "",
        data.ox1 || "", data.ox2 || "", data.ox3 || ""
      ];
    }
  },
  galaxy: {
    sheetName: "은하_답안",
    header: ["제출시각", "반", "번호", "이름",
             "복습-절대등급", "복습-베텔게우스온도", "복습-가마온도설명",
             "개념-지름", "개념-별의개수", "개념-태양계거리", "개념-위에서본모양", "개념-옆에서본모양",
             "확인문제1-선택", "확인문제2-선택",
             "OX1", "OX2",
             "교사피드백"],
    row: function (data) {
      return [
        data.reviewAbsMag || "", data.reviewBetel || "", data.reviewKilnReason || "",
        data.blankDiameter || "", data.blankStarCount || "", data.blankSunDist || "",
        data.blankTopShape || "", data.blankSideShape || "",
        data.q1Selected || "", data.q2Selected || "",
        data.ox1 || "", data.ox2 || ""
      ];
    }
  }
};

// form 필드가 아예 없는 아주 예전 요청만 시차 워크시트로 간주한다.
// FORMS에 없는 값이라도 그대로 사용해 새 워크시트용 시트를 자동으로 만든다.
function resolveForm_(formKey) {
  return formKey || "parallax";
}

function getSheet_(formKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = FORMS[formKey] ? FORMS[formKey].sheetName : formKey;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0 && FORMS[formKey]) {
    sheet.appendRow(FORMS[formKey].header);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * FORMS에 등록되지 않은(=새로 추가된) 워크시트용: payload의 키를 그대로
 * 열로 써서 기록한다. 처음 제출되면 그 순서 그대로 헤더를 만들고, 이후 새
 * 필드(문항 추가 등)가 생기면 "교사피드백" 앞에 새 열을 끼워 넣는다.
 */
function appendDynamicRow_(sheet, data) {
  const EXCLUDE = ["form", "submittedAt", "stuClass", "stuNumber", "name"];
  const fixedFront = ["반", "번호", "이름"];
  const middleKeys = Object.keys(data).filter(function (k) { return EXCLUDE.indexOf(k) === -1; });

  let header;
  if (sheet.getLastRow() === 0) {
    header = ["제출시각"].concat(fixedFront, middleKeys, ["교사피드백"]);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  } else {
    const lastCol = sheet.getLastColumn();
    header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const newKeys = middleKeys.filter(function (k) { return header.indexOf(k) === -1; });
    if (newKeys.length > 0) {
      const feedbackIdx = header.indexOf("교사피드백"); // 0-based
      const insertAt = feedbackIdx === -1 ? header.length : feedbackIdx;
      sheet.insertColumnsBefore(insertAt + 1, newKeys.length);
      sheet.getRange(1, insertAt + 1, 1, newKeys.length).setValues([newKeys]);
      header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
  }

  const fixedValues = { "반": data.stuClass || "", "번호": data.stuNumber || "", "이름": data.name || "" };
  const row = header.map(function (col) {
    if (col === "제출시각") return new Date();
    if (col === "교사피드백") return "";
    if (fixedValues.hasOwnProperty(col)) return fixedValues[col];
    return data[col] !== undefined ? data[col] : "";
  });
  sheet.appendRow(row);
}

/* ==========================================================
 * AI 조사 도우미 (Gemini API 무료 등급)
 * 워크시트가 { action: "ai", mode: "ask" | "feedback", ... } 를 보내면
 * Gemini에 물어보고 { result, text, sources } 를 돌려준다.
 * ========================================================== */
const AI_MAX_PER_MINUTE = 12;       // 무료 등급 분당 한도를 넘지 않도록 학급 전체 요청을 제한
const AI_LOG_SHEET = "AI조사_기록";
// 기본 모델이 안 될 때 차례로 시도할 무료 모델
// 앞에 있을수록 우선 사용한다. 무료 등급의 하루 한도(RPD)는 Flash Lite 계열이 가장 크다
// (예: 3.5 Flash Lite 500회/일, 3.1 Flash Lite 500회/일, 3.8 Flash 20회/일 — AI Studio [비율 제한] 화면 기준)
// 한도는 모델마다 따로 계산되므로, 3.5 Flash Lite를 다 쓰면 3.1 Flash Lite로 넘어가 하루 약 1,000회까지 쓸 수 있다.
// gemini-flash-latest 는 답하기 전에 오래 생각해서(약 40초) 맨 마지막 예비로만 둔다.
// 2.5 계열은 새 사용자에게 더 이상 제공되지 않아(404) 목록에서 뺐다.
const AI_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"];
const AI_TIME_BUDGET_MS = 25000;    // 한 질문에 다른 모델로 다시 시도하는 시간 한도

const AI_SYSTEM_PROMPT = [
  "너는 아화중학교 3학년 과학 수업의 'AI 조사 도우미'이다.",
  "수업 주제는 '미래에 대한 도전, 우주 탐사 — 우주 탐사의 의의와 인류에게 미치는 영향'이다.",
  "규칙:",
  "1. 항상 한국어로, 중학교 3학년이 이해할 수 있는 쉬운 말로 답한다.",
  "2. 4~6개의 항목(- 로 시작)으로 정리한다. 항목마다 '언제·무엇을·왜 중요한지'를 1~2문장으로 설명한다.",
  "   예: - 2022년 누리호 발사 성공 — 외국 기술 없이 1톤급 위성을 쏘아 올릴 수 있게 되어, 우주 개발을 스스로 할 수 있는 나라가 되었다는 의미가 있다.",
  "3. 전체 길이는 1,000~1,200자 정도로 쓰고, 문장이 중간에 끊기지 않게 마무리한다.",
  "4. 연도·이름·수치는 정확한 것만 쓰고, 확실하지 않으면 '확인이 필요하다'고 밝힌다.",
  "5. 항목 뒤에 '더 찾아볼 곳:'으로 시작하는 한 줄에 검색어나 기관(NASA, 한국항공우주연구원 등)을 한 가지 제안한다.",
  "6. 맨 마지막 줄에 '더 생각해 볼 질문:'으로 시작하는 질문을 하나 써서, 학생이 스스로 생각을 넓혀 보게 한다.",
  "7. 우주·천문·과학기술과 관계없는 질문, 개인정보, 부적절한 내용은 정중히 거절하고 수업 주제로 돌아오도록 안내한다.",
  "8. 학생의 과제를 대신 완성해 주지 말고, 학생이 스스로 정리할 수 있도록 조사의 출발점을 제공한다. 학생이 제출할 글을 통째로 써 달라고 하면 정중히 거절하고 정리하는 방법을 안내한다."
].join("\n");

const AI_FEEDBACK_PROMPT = [
  "너는 아화중학교 3학년 과학 수업의 'AI 조사 도우미'이다.",
  "학생이 '우주 탐사의 의의와 인류에게 미치는 영향'을 조사해 정리한 글을 읽고 짧게 피드백한다.",
  "형식: '잘한 점' 1개, '사실 확인'(틀린 내용이 있으면 바로잡고, 없으면 '특별한 오류 없음'), '보완하면 좋을 점' 1~2개.",
  "한국어로, 중학생에게 다정하게, 전체 400자 이내로 쓴다. 학생의 글을 대신 다시 써 주지 않는다."
].join("\n");

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function aiConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    key: (props.getProperty("GEMINI_API_KEY") || "").trim(),
    model: (props.getProperty("GEMINI_MODEL") || AI_MODELS[0]).trim(),
    search: (props.getProperty("GEMINI_SEARCH") || "").trim() === "on"
  };
}

// 학급 전체 요청 수를 분 단위로 센다 (무료 등급 한도 보호)
function aiAllowed_() {
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return false;
  try {
    const k = "ai_rpm_" + Math.floor(Date.now() / 60000);
    const n = Number(cache.get(k) || 0);
    if (n >= AI_MAX_PER_MINUTE) return false;
    cache.put(k, String(n + 1), 120);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function callGemini_(cfg, system, userText, useSearch) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(cfg.model) + ":generateContent";
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
  };
  if (useSearch) body.tools = [{ google_search: {} }];
  const send = function (withHeader) {
    const res = UrlFetchApp.fetch(withHeader ? url : url + "?key=" + encodeURIComponent(cfg.key), {
      method: "post",
      contentType: "application/json",
      headers: withHeader ? { "x-goog-api-key": cfg.key } : {},
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    return { code: res.getResponseCode(), body: res.getContentText() };
  };
  let r = send(true);
  // 키를 헤더로 받지 않는 경우를 대비해 주소(?key=)로 한 번 더 시도
  if ((r.code === 400 || r.code === 401 || r.code === 403) && /API[_ ]?key/i.test(r.body)) r = send(false);
  return r;
}

/**
 * [선생님용 점검] Apps Script 편집기에서 이 함수를 골라 [실행]하세요.
 * - 처음 실행하면 권한 승인 창이 뜹니다 → 승인해야 AI 조사 도우미가 동작합니다.
 * - 아래 [실행 로그]에 키 설정과 Gemini 연결 결과가 표시됩니다.
 */
function testGemini() {
  const props = PropertiesService.getScriptProperties();
  const cfg = aiConfig_();
  if (!cfg.key) {
    Logger.log("❌ 스크립트 속성 GEMINI_API_KEY 를 찾지 못했습니다. [프로젝트 설정] > [스크립트 속성]에서 이름(대소문자)을 확인하세요.");
    return;
  }
  Logger.log("키 확인: " + cfg.key.slice(0, 3) + "… (길이 " + cfg.key.length + "자)");
  Logger.log("쓸 수 있는 모델과 응답 시간을 확인합니다…");
  // AI_MODELS 순서(하루 한도가 큰 모델 우선)대로, 10초 안에 답하는 첫 모델을 쓴다.
  // 10초 안에 답하는 모델이 없으면 가장 빠른 모델을 쓴다.
  let best = null, fastest = null;
  AI_MODELS.forEach(function (m) {
    const t0 = Date.now();
    const r = callGemini_({ key: cfg.key, model: m }, "한국어로 한 문장만 답하라.", "연결 테스트입니다. 인사해 주세요.", false);
    const sec = (Date.now() - t0) / 1000;
    if (r.code === 200) {
      Logger.log("  ✅ " + m + " — " + sec.toFixed(1) + "초");
      if (!best && sec <= 10) best = { model: m, sec: sec };
      if (!fastest || sec < fastest.sec) fastest = { model: m, sec: sec };
    } else {
      let msg = "";
      try { msg = (JSON.parse(r.body).error || {}).message || ""; } catch (err) { msg = r.body; }
      Logger.log("  ❌ " + m + " — 오류 " + r.code + " " + String(msg).slice(0, 160));
    }
    Utilities.sleep(1500);    // 분당 요청 한도에 걸리지 않도록 잠깐 쉰다
  });
  best = best || fastest;
  if (!best) {
    Logger.log("❌ 쓸 수 있는 모델이 없습니다. 오류 401/403이면 키를 다시 복사해 넣고, 429면 1분 뒤 다시 실행하세요.");
    return;
  }
  props.setProperty("GEMINI_MODEL", best.model);
  const t1 = Date.now();
  const g = callGemini_({ key: cfg.key, model: best.model }, "한국어로 한 문장만 답하라.", "보이저 1호는 언제 발사되었나요?", true);
  const gsec = (Date.now() - t1) / 1000;
  const searchOk = g.code === 200 && gsec < 15;
  props.setProperty("GEMINI_SEARCH", searchOk ? "on" : "off");
  Logger.log(searchOk
    ? "✅ 구글 검색 출처 기능 사용 (" + gsec.toFixed(1) + "초)"
    : "ℹ️ 구글 검색 출처 기능은 " + (g.code === 200 ? "너무 느려서(" + gsec.toFixed(1) + "초)" : "쓸 수 없어서(오류 " + g.code + ")") + " 끕니다. 출처 링크 없이 답합니다.");
  Logger.log("✅ 설정 완료: 모델 " + best.model + " (" + best.sec.toFixed(1) + "초). 워크시트를 새로고침하면 바로 적용됩니다.");
}

function handleAi_(data) {
  const cfg = aiConfig_();
  if (!cfg.key) return json_({ result: "error", code: "no_key", message: "선생님이 아직 AI 기능을 설정하지 않았어요." });

  const mode = data.mode === "feedback" ? "feedback" : "ask";
  const topic = String(data.topic || "").slice(0, 60);
  const question = String(data.question || "").trim().slice(0, 400);
  const summary = String(data.summary || "").trim().slice(0, 1500);
  if (mode === "ask" && !question) return json_({ result: "error", code: "empty", message: "질문을 입력해 주세요." });
  if (mode === "feedback" && !summary) return json_({ result: "error", code: "empty", message: "먼저 조사한 내용을 정리해 주세요." });
  if (!aiAllowed_()) return json_({ result: "error", code: "busy", message: "지금 질문이 많이 몰렸어요. 1분쯤 뒤에 다시 시도해 주세요." });

  const system = mode === "ask" ? AI_SYSTEM_PROMPT : AI_FEEDBACK_PROMPT;
  const userText = mode === "ask"
    ? (topic ? "[조사 주제: " + topic + "]\n" : "") + question
    : "[조사 주제: " + (topic || "자유 주제") + "]\n학생이 정리한 글:\n" + summary;

  // 시도 순서: (구글 검색 출처 포함) → 검색 없이 → 다른 무료 모델
  // 무료 등급은 검색 출처 기능의 한도가 0이거나 금방 차는 경우가 많아, 실패하면 10분 동안 검색 없이 답한다.
  const cache = CacheService.getScriptCache();
  const tries = [];
  if (mode === "ask" && cfg.search && !cache.get("ai_nosearch")) tries.push({ model: cfg.model, search: true });
  tries.push({ model: cfg.model, search: false });
  AI_MODELS.forEach(function (m) { if (m !== cfg.model) tries.push({ model: m, search: false }); });

  const started = Date.now();
  let r = null;
  for (let i = 0; i < tries.length; i++) {
    if (i > 0 && Date.now() - started > AI_TIME_BUDGET_MS) break;   // 너무 오래 걸리면 그만 기다린다
    r = callGemini_({ key: cfg.key, model: tries[i].model }, system, userText, tries[i].search);
    if (r.code === 200) break;
    if (tries[i].search) cache.put("ai_nosearch", "1", 600);
    if (r.code === 401 || r.code === 403) break;            // 키 문제는 다른 모델로 바꿔도 같다
  }
  if (r.code !== 200) {
    logAi_(data, "오류 " + r.code, topic, mode === "ask" ? question : summary, r.body.slice(0, 1000));
    if (r.code === 429) return json_({ result: "error", code: "busy", message: "AI 무료 사용량이 잠시 꽉 찼어요. 1분쯤 뒤에 다시 시도해 주세요." });
    return json_({ result: "error", code: "api", message: "AI 응답을 받지 못했어요. (오류 " + r.code + ")" });
  }

  const out = JSON.parse(r.body);
  const cand = (out.candidates || [])[0] || {};
  const text = ((cand.content || {}).parts || []).map(function (p) { return p.text || ""; }).join("").trim();
  if (!text) return json_({ result: "error", code: "blocked", message: "이 질문에는 답할 수 없어요. 수업 주제와 관련된 질문으로 바꿔 보세요." });

  const sources = [];
  ((cand.groundingMetadata || {}).groundingChunks || []).forEach(function (c) {
    if (c.web && c.web.uri && sources.length < 5) sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri });
  });

  logAi_(data, mode === "ask" ? "질문" : "피드백", topic, mode === "ask" ? question : summary, text.slice(0, 3000));
  return json_({ result: "success", text: text, sources: sources });
}

// 질문·답변(또는 오류 내용)을 "AI조사_기록" 시트에 남긴다
function logAi_(data, kind, topic, input, output) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let log = ss.getSheetByName(AI_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(AI_LOG_SHEET);
      log.appendRow(["시각", "반", "번호", "이름", "종류", "주제", "질문/정리한 글", "AI 답변"]);
      log.setFrozenRows(1);
    }
    log.appendRow([new Date(), data.stuClass || "", data.stuNumber || "", data.name || "", kind, topic, input, output]);
  } catch (logErr) { /* 기록 실패는 답변에 영향을 주지 않는다 */ }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "ai") return handleAi_(data);
    const formKey = resolveForm_(data.form);
    const sheet = getSheet_(formKey);

    if (FORMS[formKey]) {
      sheet.appendRow([
        new Date(),
        data.stuClass || "",
        data.stuNumber || "",
        data.name || ""
      ].concat(FORMS[formKey].row(data), [""])); // 마지막 칸: 교사피드백, 처음엔 비워둠
    } else {
      appendDynamicRow_(sheet, data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * (선택) 학생이 자신의 피드백을 조회할 때 사용.
 * 예: GET 요청으로 ?form=brightness&stuClass=9&stuNumber=1&name=홍길동 을 보내면
 * 해당 학생의 가장 최근 제출 행에서 교사피드백 칸을 돌려준다. (form 생략 시 시차 워크시트 기준)
 * 별도의 "피드백 조회 페이지"를 만들 때 fetch(GET)로 호출하면 된다.
 */
function doGet(e) {
  // 워크시트가 AI 조사 도우미를 쓸 수 있는지 확인할 때 사용
  if (e.parameter.action === "ai_status") {
    const cfg = aiConfig_();
    return json_({ ai: !!cfg.key, model: cfg.key ? cfg.model : "", search: cfg.search });
  }
  const formKey = resolveForm_(e.parameter.form);
  const stuClass = e.parameter.stuClass || "";
  const stuNumber = e.parameter.stuNumber || "";
  const name = e.parameter.name || "";
  const sheet = getSheet_(formKey);
  const values = sheet.getDataRange().getValues();

  let found = null;
  for (let i = values.length - 1; i >= 1; i--) { // 최신 제출부터 검색
    const row = values[i];
    if (String(row[1]) === String(stuClass) && String(row[2]) === String(stuNumber) && row[3] === name) {
      found = {
        submittedAt: row[0],
        stuClass: row[1],
        stuNumber: row[2],
        name: row[3],
        feedback: row[row.length - 1] // 교사피드백은 항상 마지막 열
      };
      break;
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(found || { result: "not_found" }))
    .setMimeType(ContentService.MimeType.JSON);
}
