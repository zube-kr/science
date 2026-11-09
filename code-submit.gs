/**
 * 아화중학교 과학 — 과제제출방(파일 업로드) Apps Script
 * ------------------------------------------------------------------
 * assignment-submit.html 에서 학생이 올린 파일(jpg/png/pdf/doc/hwp)을
 * 선생님 구글 드라이브의 "아화중_과제제출" 폴더에 저장하고,
 * 이 스프레드시트의 "제출기록" 탭에 한 줄씩 기록합니다.
 *
 * ▣ 설치 방법 (처음 한 번)
 * 1) 구글 스프레드시트를 새로 만듭니다. (이름 예: 아화중_과제제출)
 * 2) 확장 프로그램 → Apps Script 를 열고, 기본 코드를 지운 뒤 이 파일의
 *    내용을 전체 붙여넣고 저장합니다.
 * 3) 아래 SUBMIT_CODE(학생 제출코드), TEACHER_CODE(교사 현황 확인 코드)를
 *    정해서 적습니다.  ※ 이 저장소에 올라간 파일에는 실제 코드를 적지 않습니다.
 * 4) 위쪽 함수 선택 칸에서 setup 을 고르고 [실행] → 권한 허용
 *    (드라이브·스프레드시트 권한). "과제목록", "제출기록" 탭과
 *    드라이브 "아화중_과제제출" 폴더가 자동으로 만들어집니다.
 * 5) 배포 → 새 배포 → 유형: 웹 앱
 *      - 실행 대상: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자
 *    로 배포하고, 발급된 웹 앱 URL(…/exec)을 assignment-submit.html 의
 *      const SUBMIT_API = "";
 *    에 넣습니다.
 *
 * ▣ 과제 추가·마감
 *   "과제목록" 탭에 한 줄씩 적으면 바로 학생 화면에 나타납니다.
 *   (학년 | 과제명 | 설명 | 마감일 | 공개)
 *   - 마감일이 지나도 제출은 되지만 "지각"으로 표시됩니다.
 *   - 공개 칸을 FALSE(체크 해제)로 바꾸면 학생 화면에서 사라집니다.
 *
 * ▣ 코드를 수정했을 때
 *   배포 → 배포 관리 → (연필) → 버전: 새 버전 → 배포  (주소는 그대로 유지)
 */

var SUBMIT_CODE = "여기에_학생_제출코드";    // 예: "1234"
var TEACHER_CODE = "여기에_교사_확인코드";   // 예: "987654"

var ROOT_FOLDER_NAME = "아화중_과제제출";
var MAX_BYTES = 10 * 1024 * 1024; // 파일 1개 최대 10MB
var ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf", "doc", "docx", "hwp", "hwpx"];

// 학년 → 반 → 번호 → 이름
var ROSTER = {
  "1": { "1": { "1": "유민석", "2": "이예인", "3": "이원근" } }
};

var TASK_SHEET = "과제목록";
var LOG_SHEET = "제출기록";
var LOG_HEADER = ["제출시각", "학년", "반", "번호", "이름", "과제", "파일명", "크기(KB)", "지각", "파일 링크", "파일ID"];

/* ---------------- 처음 설정 ---------------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t = ss.getSheetByName(TASK_SHEET);
  if (!t) {
    t = ss.insertSheet(TASK_SHEET);
    t.appendRow(["학년", "과제명", "설명", "마감일", "공개"]);
    t.appendRow(["1", "2026.11.9. 4컷만화 (기체의 성질)", "기체의 성질을 4컷만화로 그려 사진이나 파일로 올려 주세요.", "", true]);
    t.setFrozenRows(1);
    t.getRange("E2:E200").insertCheckboxes();
    t.getRange("D2:D200").setNumberFormat("yyyy-mm-dd");
    t.setColumnWidth(2, 260); t.setColumnWidth(3, 360);
  }
  var l = ss.getSheetByName(LOG_SHEET);
  if (!l) {
    l = ss.insertSheet(LOG_SHEET);
    l.appendRow(LOG_HEADER);
    l.setFrozenRows(1);
  }
  var root = getRootFolder_();
  Logger.log("준비 완료! 드라이브 폴더: " + root.getUrl());
}

/* ---------------- 공통 ---------------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getRootFolder_() {
  var it = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getSubFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function safeName_(s) {
  return String(s).replace(/[\\\/:*?"<>|#%\r\n\t]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80);
}

function pad2_(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

function fmtDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
}

function dueEnd_(due) {
  // 마감일 당일 23:59:59까지는 정시 제출
  if (!due) return null;
  var d = (due instanceof Date) ? new Date(due.getTime()) : new Date(String(due).replace(/\./g, "-"));
  if (isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function readTasks_(grade, includeHidden) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASK_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  var out = [];
  rows.forEach(function (r) {
    var g = String(r[0]).replace(/[^0-9]/g, "");
    var title = String(r[1] || "").trim();
    if (!title || (grade && g !== String(grade))) return;
    var open = !(r[4] === false || String(r[4]).toUpperCase() === "FALSE");
    if (!open && !includeHidden) return;
    var end = dueEnd_(r[3]);
    out.push({ grade: g, title: title, desc: String(r[2] || ""), due: end ? Utilities.formatDate(end, Session.getScriptTimeZone() || "Asia/Seoul", "yyyy-MM-dd") : "", open: open });
  });
  return out;
}

function readLog_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, LOG_HEADER.length).getValues().map(function (r) {
    return {
      time: r[0] instanceof Date ? fmtDate_(r[0]) : String(r[0]),
      grade: String(r[1]), cls: String(r[2]), num: String(r[3]), name: String(r[4]),
      task: String(r[5]), file: String(r[6]), kb: r[7], late: r[8] === "지각", url: String(r[9])
    };
  });
}

/* ---------------- GET: 과제목록 / 코드확인 / 내 기록 / 교사 현황 ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === "tasks") {
      return json_({ ok: true, tasks: readTasks_(p.grade || "1", false) });
    }
    if (p.action === "check") {
      return json_({ ok: String(p.code) === SUBMIT_CODE });
    }
    if (p.action === "mine") {
      if (String(p.code) !== SUBMIT_CODE) return json_({ ok: false, error: "제출코드가 맞지 않아요." });
      var mine = readLog_().filter(function (r) {
        return r.grade === String(p.grade) && r.cls === String(p.cls) && r.num === String(p.num);
      }).map(function (r) { return { time: r.time, task: r.task, file: r.file, kb: r.kb, late: r.late }; });
      return json_({ ok: true, items: mine });
    }
    if (p.action === "status") {
      if (String(p.tcode) !== TEACHER_CODE) return json_({ ok: false, error: "교사 코드가 맞지 않아요." });
      var g = p.grade || "1";
      return json_({
        ok: true,
        tasks: readTasks_(g, true),
        roster: ROSTER[g] || {},
        log: readLog_().filter(function (r) { return r.grade === String(g); }),
        folder: getRootFolder_().getUrl()
      });
    }
    return json_({ ok: true, msg: "아화중 과제제출방 API" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------------- POST: 파일 1개 제출 ---------------- */
function doPost(e) {
  var lock = null;
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (String(d.code) !== SUBMIT_CODE) return json_({ ok: false, error: "제출코드가 맞지 않아요." });

    var grade = String(d.grade), cls = String(d.cls), num = String(d.num);
    var name = ROSTER[grade] && ROSTER[grade][cls] && ROSTER[grade][cls][num];
    if (!name || name !== String(d.name)) return json_({ ok: false, error: "명단에 없는 학생이에요." });

    var task = null;
    readTasks_(grade, false).forEach(function (t) { if (t.title === String(d.task)) task = t; });
    if (!task) return json_({ ok: false, error: "열려 있는 과제가 아니에요. 새로고침해 보세요." });

    var orig = safeName_(d.fileName || "file");
    var ext = (orig.split(".").pop() || "").toLowerCase();
    if (orig.indexOf(".") < 0 || ALLOWED_EXT.indexOf(ext) < 0) {
      return json_({ ok: false, error: "jpg, png, pdf, doc(x), hwp(x) 파일만 올릴 수 있어요." });
    }
    var bytes = Utilities.base64Decode(String(d.data || ""));
    if (!bytes.length) return json_({ ok: false, error: "빈 파일이에요." });
    if (bytes.length > MAX_BYTES) return json_({ ok: false, error: "파일이 10MB보다 커요." });

    var now = new Date();
    var end = dueEnd_(task.due);
    var late = end && now.getTime() > end.getTime();

    var folder = getSubFolder_(getSubFolder_(getRootFolder_(), grade + "학년"), safeName_(task.title));
    var base = grade + "-" + cls + "_" + pad2_(num) + "_" + name + "_" + orig.replace(/\.[^.]+$/, "");
    var fileName = base + "." + ext;
    var k = 2;
    while (folder.getFilesByName(fileName).hasNext()) fileName = base + "(" + (k++) + ")." + ext;

    var blob = Utilities.newBlob(bytes, d.mimeType || "application/octet-stream", fileName);
    var file = folder.createFile(blob);

    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
    if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET); }
    sh.appendRow([now, grade, cls, num, name, task.title, fileName, Math.round(bytes.length / 1024), late ? "지각" : "", file.getUrl(), file.getId()]);

    return json_({ ok: true, fileName: fileName, late: !!late, time: fmtDate_(now) });
  } catch (err) {
    return json_({ ok: false, error: "저장 중 오류: " + String(err) });
  } finally {
    if (lock) try { lock.releaseLock(); } catch (x) {}
  }
}
