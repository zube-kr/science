/**
 * 아화중학교 질문탐구한마당 — 연습 워크시트 · 교사 대시보드용 Apps Script
 * (스프레드시트 이름 예: 아화중_질문탐구한마당)
 *
 * question-festival.html(학생 워크시트)과 question-festival-dashboard.html(교사 대시보드)이
 * 함께 쓰는 전용 서버입니다. 3학년 과학 워크시트용 시트(아화중_중3_워크시트)와는 따로 동작합니다.
 *
 * ▣ 저장되는 곳 (탭은 처음 기록될 때 자동으로 만들어져요)
 *   - 질문탐구_질문     : 학생이 [질문 보내기]로 보낸 질문 (한 줄에 질문 하나)
 *   - 질문탐구_워크시트 : 학생이 [제출하기]로 보낸 워크시트 전체
 *   - AI조사_기록       : AI 조사 도우미에게 한 질문과 답
 *
 * ▣ 설치 방법 (처음 한 번)
 * 1. 구글 스프레드시트를 새로 만든다. (이름 예: 아화중_질문탐구한마당)
 * 2. [확장 프로그램] > [Apps Script]를 열고, 기본 코드를 지운 뒤 이 파일 내용 전체를 붙여넣고 저장한다.
 * 3. 아래 INQUIRY_TEACHER_CODE 에 교사 대시보드 접속 코드(숫자·영문 4자리 이상)를 적는다.
 *    ※ 이 저장소에 올라간 파일에는 실제 코드를 적지 않는다.
 * 4. (AI 조사 도우미를 쓰려면) 왼쪽 [프로젝트 설정(톱니바퀴)] > [스크립트 속성] > [스크립트 속성 추가]
 *    - 속성: GEMINI_API_KEY   값: Gemini API 키 (3학년 워크시트에서 쓰는 키를 그대로 써도 됨)
 *    그다음 위쪽 함수 목록에서 testGemini 를 고르고 [실행] → 권한 승인.
 *    실행 로그에 "설정 완료"가 보이면 OK. (모델·검색 설정을 자동으로 저장해 줘요)
 * 5. [배포] > [새 배포] > 유형: 웹 앱
 *    - 실행 계정: 나
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 6. 발급된 웹 앱 URL(…/exec)을 두 HTML 파일의  const APPS_SCRIPT_URL = "";  에 넣는다.
 *
 * ▣ 학생 로그인(고유코드)
 *   교사 대시보드의 [👥 학생 명단·코드]에 명단을 붙여넣고 저장하면 "학생명단" 탭에
 *   학생마다 겹치지 않는 4자리 코드가 만들어진다. 선생님이 정한 4자리로 바꿀 수도 있다
 *   (명단에 "번호 이름 코드"로 적거나, 대시보드 표의 [코드 정하기], 또는 이 탭의 코드 칸을 직접 고쳐도 된다). 학생은 워크시트에서 반·번호·코드로
 *   로그인해서, 저장해 둔 내용을 다른 날·다른 기기에서도 이어서 할 수 있다.
 *   학생이 쓰던 내용은 "질문탐구_저장" 탭에 학생마다 한 줄로 저장된다(자동 저장 포함).
 *   ※ 학생 이름과 코드는 이 시트에만 저장되고 웹페이지 파일에는 들어가지 않는다.
 *
 * ▣ 코드를 고쳤을 때: [배포] > [배포 관리] > 연필 > 버전: "새 버전" > [배포]  (URL은 그대로)
 */

const INQUIRY_TEACHER_CODE = "여기에_교사코드";   // 교사 대시보드 접속 코드
const DEFAULT_UNIT = "질문탐구한마당 — 『나는 나로 살기로 했다』(김수현)";
const ALLOWED_FORMS = ["질문탐구_질문", "질문탐구_워크시트"];
const ROSTER_SHEET = "학생명단";
const SAVE_SHEET = "질문탐구_저장";
const ROSTER_HEAD = ["반", "번호", "이름", "코드", "마지막로그인"];
const SAVE_HEAD = ["반", "번호", "이름", "저장시각", "저장종류", "진행-탐색", "진행-생성", "진행-선정", "진행-탐구", "진행-발표", "메타응답수", "상태"];

/* ==========================================================
 * 기록 저장: payload 의 키를 그대로 열 제목으로 쓴다
 * (반/번호/이름은 맨 앞, 교사피드백은 맨 뒤)
 * ========================================================== */
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

function inquirySystemPrompt_(unit) {
  return [
    "너는 아화중학교 3학년 학생들의 '질문·탐구 궁금한마당' 대회 연습을 돕는 'AI 조사 도우미'이다.",
    "연습 주제: " + unit + ". 학생들은 책의 한 부분(지문)을 읽고 탐색(관심어 찾기) → 생성(질문 만들기) → 선정(질문 2개 고르고 다듬기) → 탐구(검색·토의로 답 찾기) → 발표 순서로 활동한다.",
    "대회 규칙상 AI는 '선정'과 '탐구' 단계에서만 쓴다. 대회는 검색하면 바로 알 수 있는 답이나 전문가의 결론보다 학생의 질문·탐구 과정과 소통·성찰을 중요하게 본다.",
    "규칙:",
    "1. 항상 한국어로, 중학교 3학년 눈높이에 맞춰 친절하게 답한다.",
    "2. 정답이나 결론을 바로 정해 주지 말고, 학생이 스스로 탐구할 수 있도록 생각할 관점·근거·자료를 찾는 방향을 제시한다.",
    "3. 3~5개의 항목(- 로 시작)으로 정리하고, 전체 700~1,000자 정도로 문장이 끊기지 않게 마무리한다.",
    "4. 책의 문장을 지어내거나 길게 인용하지 않는다. 책의 구체적인 내용이 필요한 질문에는 '책에서 직접 확인해 보세요'라고 안내하고, 자존감·타인의 시선·비교·관계·사회의 기준처럼 널리 알려진 주제 수준에서만 이야기한다.",
    "5. 통계·연구·용어는 확실한 것만 쓰고, 확실하지 않으면 '확인이 필요하다'고 밝힌다. 확인할 수 있는 믿을 만한 곳(통계청 국가통계포털 KOSIS, 한국청소년정책연구원, 국립국어원 표준국어대사전, 공공기관 누리집 등)이나 검색어를 제안한다.",
    "6. 질문 선정·다듬기에 대한 질문이면, 그 질문이 '참신하면서 우리 삶에서 의미가 있는지', '90분 안에 탐구할 수 있는지'를 기준으로 조언하고, 범위를 좁히거나 대상·기준을 분명히 하는 다듬기 예시를 보여 준다. 어떤 질문을 고를지는 학생이 정하게 한다.",
    "7. 탐구에 대한 질문이면, 용어 정리 → 자료·사례 찾기 → 비교·분석 → 잠정적인 답 순서로 탐구 방법을 안내한다.",
    "8. 맨 마지막 줄에 '이어진 질문:'으로 시작하는 질문을 하나 써서 학생이 생각을 넓혀 보게 한다.",
    "9. 개인 정보나 부적절한 내용은 정중히 거절한다. 학생 자신의 고민처럼 보이는 질문에는 먼저 공감하고, 필요하면 담임 선생님이나 상담 선생님과 이야기해 보도록 권한다.",
    "10. 학생이 제출할 글이나 발표문을 통째로 써 달라고 하면 정중히 거절하고, 스스로 정리하는 방법을 안내한다."
  ].join("\n");
}

function inquiryFeedbackPrompt_(unit) {
  return [
    "너는 '" + unit + "' 질문탐구 연습을 돕는 'AI 조사 도우미'이다.",
    "학생이 정리한 탐구 질문, 잠정적인 답, 이어진 질문을 읽고 짧게 피드백한다.",
    "형식: '잘한 점' 1개, '질문 점검'(참신성·삶과의 연결·90분 안 탐구 가능성 중 가장 필요한 것 한 가지), '근거 확인'(근거가 부족하거나 사실과 다른 부분, 없으면 '특별한 문제 없음'), '보완하면 좋을 점' 1~2개.",
    "한국어로, 중학생에게 다정하게, 전체 450자 이내로 쓴다. 학생의 글을 대신 다시 써 주지 않는다."
  ].join("\n");
}

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

// 분 단위 요청 수 제한 (무료 등급 보호)
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

/** 처음 한 번 실행: 키 확인, 쓸 모델·검색 기능 자동 설정 */
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
  const unit = String(data.unit || "").trim().slice(0, 80);     // 워크시트가 보내는 단원·차시 이름
  const topic = String(data.topic || "").slice(0, 60);
  const question = String(data.question || "").trim().slice(0, 400);
  const summary = String(data.summary || "").trim().slice(0, 1500);
  if (mode === "ask" && !question) return json_({ result: "error", code: "empty", message: "질문을 입력해 주세요." });
  if (mode === "feedback" && !summary) return json_({ result: "error", code: "empty", message: "먼저 조사한 내용을 정리해 주세요." });
  if (!aiAllowed_()) return json_({ result: "error", code: "busy", message: "지금 질문이 많이 몰렸어요. 1분쯤 뒤에 다시 시도해 주세요." });

  const system = mode === "ask" ? inquirySystemPrompt_(unit || DEFAULT_UNIT) : inquiryFeedbackPrompt_(unit || DEFAULT_UNIT);
  const logTopic = [unit, topic].filter(String).join(" · ");     // 기록 시트 '주제' 칸: 단원 · 조사 주제
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
    logAi_(data, "오류 " + r.code, logTopic, mode === "ask" ? question : summary, r.body.slice(0, 1000));
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

  logAi_(data, mode === "ask" ? "질문" : "피드백", logTopic, mode === "ask" ? question : summary, text.slice(0, 3000));
  return json_({ result: "success", text: text, sources: sources });
}

// 질문·답변을 "AI조사_기록" 시트에 남긴다
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

/* ==========================================================
 * 교사 대시보드: { action:"inquiry_dashboard", code } (POST)
 * ========================================================== */
// 교사 코드 확인: 맞으면 null, 틀리면 오류 응답을 돌려준다
function teacherCheck_(data) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("inq_fail") || 0);
  if (!/^\S{4,}$/.test(INQUIRY_TEACHER_CODE) || INQUIRY_TEACHER_CODE.indexOf("여기에") === 0) {
    return json_({ result: "error", message: "Apps Script의 INQUIRY_TEACHER_CODE를 먼저 정해 주세요." });
  }
  if (fails >= 10) return json_({ result: "error", message: "코드가 여러 번 틀려서 10분 동안 잠겼어요." });
  if (String(data.code || "") !== INQUIRY_TEACHER_CODE) {
    cache.put("inq_fail", String(fails + 1), 600);
    return json_({ result: "error", message: "교사 코드가 맞지 않아요." });
  }
  cache.remove("inq_fail");
  return null;
}

function readRows_(name, filter, limit) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), head = v[0].map(String), out = [];
  for (let i = 1; i < v.length; i++) {
    const o = {};
    head.forEach(function (h, j) { const c = v[i][j]; o[h] = c instanceof Date ? c.toISOString() : c; });
    if (!filter || filter(o)) out.push(o);
  }
  return out.slice(-(limit || 1000));
}

function inquiryDashboard_(data) {
  const bad = teacherCheck_(data);
  if (bad) return bad;
  return json_({
    result: "success",
    questions: readRows_("질문탐구_질문"),
    worksheets: readRows_("질문탐구_워크시트"),
    ai: readRows_(AI_LOG_SHEET, null, 1500),
    roster: readRows_(ROSTER_SHEET),
    saves: readRows_(SAVE_SHEET).map(function (o) { delete o["상태"]; return o; })   // 진행 요약만 (긴 상태 글은 빼고)
  });
}

/* ==========================================================
 * 학생 명단 · 고유코드 (교사)
 * ========================================================== */
function sheetWithHead_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function rosterAll_() {
  const sh = sheetWithHead_(ROSTER_SHEET, ROSTER_HEAD);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, ROSTER_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, cls: String(r[0]).trim(), num: String(r[1]).trim(), name: String(r[2]).trim(), code: code4_(r[3]) };
  }).filter(function (x) { return x.name; });
}
// 시트가 0123 을 123 으로 바꿔 저장해도 4자리로 맞춰 읽는다
function code4_(v) { const t = String(v).trim(); return /^\d{1,4}$/.test(t) ? ("0000" + t).slice(-4) : t; }
// 0으로 시작하는 코드도 글자 그대로 저장되도록 앞에 ' 를 붙인다
const codeCell_ = function (c) { return "'" + c; };
function newCode_(taken) {
  for (let i = 0; i < 5000; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    if (!taken[c]) { taken[c] = true; return c; }
  }
  throw new Error("코드를 만들지 못했어요.");
}
// { action:"roster_save", code, rows:[{cls,num,name}] } — 같은 반·번호는 이름만 고치고 코드는 그대로 둔다
function rosterSave_(data) {
  const bad = teacherCheck_(data);
  if (bad) return bad;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheetWithHead_(ROSTER_SHEET, ROSTER_HEAD), list = rosterAll_(), taken = {}, byKey = {};
    list.forEach(function (x) { taken[x.code] = true; byKey[x.cls + "-" + x.num] = x; });
    (Array.isArray(data.rows) ? data.rows : []).slice(0, 200).forEach(function (r) {
      const cls = String(r.cls || "").trim(), num = String(r.num || "").trim(), name = String(r.name || "").trim().slice(0, 20);
      const want = /^\d{4}$/.test(String(r.code || "").trim()) ? String(r.code).trim() : "";   // 선생님이 정한 코드(선택)
      if (!cls || !num || !name) return;
      const old = byKey[cls + "-" + num];
      if (old) {
        if (old.name !== name) sh.getRange(old.row, 3).setValue(name);
        if (want && old.row && want !== old.code) { sh.getRange(old.row, 4).setValue(codeCell_(want)); taken[want] = true; }
      } else {
        sh.appendRow([cls, num, name, codeCell_(want || newCode_(taken)), ""]);
        if (want) taken[want] = true;
        byKey[cls + "-" + num] = { cls: cls, num: num, name: name };
      }
    });
    if (data.newCodeFor) {   // 코드 다시 만들기 { newCodeFor: "1-3", code: "선생님이 정한 4자리(없으면 자동)" }
      const x = rosterAll_().filter(function (y) { return y.cls + "-" + y.num === String(data.newCodeFor); })[0];
      const want = /^\d{4}$/.test(String(data.setCode || "").trim()) ? String(data.setCode).trim() : "";
      if (x) sh.getRange(x.row, 4).setValue(codeCell_(want || newCode_(taken)));
    }
    if (data.remove) {       // 명단에서 빼기 { remove: "1-3" }
      const y = rosterAll_().filter(function (z) { return z.cls + "-" + z.num === String(data.remove); })[0];
      if (y) sh.deleteRow(y.row);
    }
  } finally { lock.releaseLock(); }
  return json_({ result: "success", roster: readRows_(ROSTER_SHEET) });
}

/* ==========================================================
 * 학생 로그인 · 저장 · 불러오기
 * ========================================================== */
// 코드 맞히기 막기: 같은 반·번호 5번 → 5분, 전체 10분에 30번 → 10분 잠금 (서버에서 센다)
function studentCheck_(data) {
  const cache = CacheService.getScriptCache();
  const cls = String(data.cls || "").trim(), num = String(data.num || "").trim(), code = String(data.stuCode || "").trim();
  const kOne = "lf_" + cls + "-" + num, nOne = Number(cache.get(kOne) || 0), nAll = Number(cache.get("lf_all") || 0);
  if (nAll >= 30) return { error: "틀린 코드가 너무 많아서 10분 동안 로그인을 막았어요. 잠시 후 다시 해 주세요." };
  if (nOne >= 5) return { error: "이 번호는 코드를 여러 번 틀려서 5분 동안 로그인할 수 없어요." };
  const me = rosterAll_().filter(function (x) { return x.cls === cls && x.num === num && x.code === code; })[0];
  if (!me) {
    cache.put(kOne, String(nOne + 1), 300); cache.put("lf_all", String(nAll + 1), 600);
    return { error: "반·번호 또는 코드가 맞지 않아요." };
  }
  cache.remove(kOne);
  return { me: me };
}
function saveRowOf_(me) {
  const sh = sheetWithHead_(SAVE_SHEET, SAVE_HEAD), n = sh.getLastRow() - 1;
  if (n < 1) return { sh: sh, row: 0, values: null };
  const v = sh.getRange(2, 1, n, SAVE_HEAD.length).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === me.cls && String(v[i][1]) === me.num) return { sh: sh, row: i + 2, values: v[i] };
  return { sh: sh, row: 0, values: null };
}
// { action:"student_login", cls, num, stuCode }
function studentLogin_(data) {
  const c = studentCheck_(data);
  if (c.error) return json_({ result: "error", message: c.error });
  const me = c.me;
  try { SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET).getRange(me.row, 5).setValue(new Date()); } catch (e) {}
  const s = saveRowOf_(me);
  let saved = null;
  if (s.values) {
    const at = s.values[3];
    saved = { at: at instanceof Date ? at.toISOString() : String(at), kind: String(s.values[4]), state: String(s.values[11] || "") };
  }
  return json_({ result: "success", student: { cls: me.cls, num: me.num, name: me.name }, saved: saved });
}
// { action:"student_save", cls, num, stuCode, kind, progress:{...}, state:"JSON", row:{...워크시트 한 줄(중간·최종일 때)} }
function studentSave_(data) {
  const c = studentCheck_(data);
  if (c.error) return json_({ result: "error", message: c.error });
  const me = c.me, state = String(data.state || "");
  if (state.length > 45000) return json_({ result: "error", message: "저장할 내용이 너무 길어요. 긴 글을 조금 줄여 주세요." });
  const pr = data.progress || {}, now = new Date(), kind = String(data.kind || "자동 저장").slice(0, 20);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = saveRowOf_(me);
    const line = [me.cls, me.num, me.name, now, kind, pr["탐색"] || "", pr["생성"] || "", pr["선정"] || "", pr["탐구"] || "", pr["발표"] || "", pr["메타"] || 0, state];
    if (s.row) s.sh.getRange(s.row, 1, 1, SAVE_HEAD.length).setValues([line]);
    else s.sh.appendRow(line);
    if (data.row && typeof data.row === "object") {   // 중간 저장·최종 제출은 워크시트 기록에도 한 줄 남긴다
      const row = data.row;
      row.stuClass = me.cls; row.stuNumber = me.num; row.name = me.name;   // 이름은 명단 기준
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      appendDynamicRow_(ss.getSheetByName("질문탐구_워크시트") || ss.insertSheet("질문탐구_워크시트"), row);
    }
  } finally { lock.releaseLock(); }
  return json_({ result: "success", savedAt: now.toISOString() });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "ai") return handleAi_(data);
    if (data.action === "inquiry_dashboard") return inquiryDashboard_(data);
    if (data.action === "roster_save") return rosterSave_(data);
    if (data.action === "student_login") return studentLogin_(data);
    if (data.action === "student_save") return studentSave_(data);
    // 학생 기록: 정해진 탭에만 저장한다
    if (ALLOWED_FORMS.indexOf(data.form) === -1) return json_({ result: "error", message: "알 수 없는 기록 종류예요." });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(data.form) || ss.insertSheet(data.form);
    appendDynamicRow_(sheet, data);
    return json_({ result: "success" });
  } catch (err) {
    return json_({ result: "error", message: err.message });
  }
}

function doGet(e) {
  // 워크시트가 AI 조사 도우미를 쓸 수 있는지 확인
  if (e && e.parameter && e.parameter.action === "ai_status") {
    const cfg = aiConfig_();
    return json_({ ai: !!cfg.key, model: cfg.key ? cfg.model : "", search: cfg.search });
  }
  return json_({ result: "ok", message: "질문탐구한마당 서버가 동작 중입니다." });
}
