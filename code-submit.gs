/**
 * 아화중학교 과학 — 과제제출방(파일 업로드) Apps Script
 * ------------------------------------------------------------------
 * assignment-submit.html 에서 학생이 올린 파일(jpg/png/pdf/doc/hwp, 코드 파일 ino/py/txt/html)을
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
 *   - 학년 칸에 1·2·3을 적으면 그 학년 과제제출방에만 보입니다.
 *     (학생 화면: assignment-submit.html, ?grade=2, ?grade=3)
 *   - 마감일이 지나도 제출은 되지만 "지각"으로 표시됩니다.
 *   - 공개 칸을 FALSE(체크 해제)로 바꾸면 학생 화면에서 사라집니다.
 *
 * ▣ 학생 개발자료 게시판 (student-dev/board.html)
 *   학생이 만든 HTML 파일(게임·시뮬레이션 등)을 올리고, 다른 학생이 실행해 보거나 내려받는 게시판입니다.
 *   같은 웹 앱 주소·같은 제출코드를 씁니다. 파일은 드라이브 "아화중_과제제출/개발자료게시판" 폴더에,
 *   목록은 이 스프레드시트의 "개발자료게시판" 탭에 저장됩니다(처음 올릴 때 자동으로 만들어짐).
 *   - GALLERY_NEED_APPROVAL = true 이면 선생님이 '공개'를 체크해야 게시판에 보입니다.
 *     (게시판 페이지 아래 '선생님용 관리'에서 교사 코드로 공개/숨김을 바꾸거나, 시트의 '공개' 칸을 체크)
 *   - GALLERY_NAME_STYLE: "mask"(유○석) / "full"(유민석) / "none"(이름 숨김)
 *   - 입장 코드: 코드를 입력해야 목록을 보고 실행·다운로드할 수 있어요(서버에서 확인).
 *     GALLERY_VIEW_CODE 를 비워 두면 제출코드로 입장, 따로 적으면 그 코드로도 입장
 *   - 선생님 자료: 게시판의 '선생님용 관리'에서 교사 코드로 올리면 바로 공개되고 목록 맨 위에 고정됩니다.
 *     html·pdf·hwp·ppt·엑셀·zip·사진 등 20MB까지 (드라이브 "개발자료게시판/선생님" 폴더)
 *
 * ▣ 코드를 수정했을 때
 *   배포 → 배포 관리 → (연필) → 버전: 새 버전 → 배포  (주소는 그대로 유지)
 */

var SUBMIT_CODE = "여기에_학생_제출코드";    // 예: "1234"
var TEACHER_CODE = "여기에_교사_확인코드";   // 예: "987654"

var ROOT_FOLDER_NAME = "아화중_과제제출";
var MAX_BYTES = 10 * 1024 * 1024; // 파일 1개 최대 10MB
var ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf", "doc", "docx", "hwp", "hwpx", "ino", "py", "txt", "html", "htm"];
var CODE_EXT = ["ino", "py", "txt", "html", "htm"]; // 코드 파일: 일반 텍스트로 저장

// 학년 → 반 → 번호 → 이름
var ROSTER = {
  "1": { "1": { "1": "유민석", "2": "이예인", "3": "이원근" } },
  "2": { "1": { "1": "김민지", "2": "김수현", "3": "김진영", "4": "박제민", "5": "손현정", "6": "이재경", "7": "전아라" } },
  "3": { "1": { "1": "김서빈", "2": "김서현", "3": "김상환", "4": "이시우", "5": "신윤호", "6": "이준", "7": "이정호", "8": "방시현" } }
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
    t.setFrozenRows(1);
    t.getRange("E2:E200").insertCheckboxes();
    t.getRange("D2:D200").setNumberFormat("yyyy-mm-dd");
    t.setColumnWidth(2, 260); t.setColumnWidth(3, 360);
  }
  // 기본 과제: "과제목록"에 같은 과제명이 없을 때만 맨 아래에 추가합니다.
  // (setup 을 다시 실행해도 이미 있는 과제는 중복으로 추가되지 않아요.)
  var DEFAULT_TASKS = [
    ["1", "2026.11.9. 4컷만화 (기체의 성질)", "기체의 성질을 4컷만화로 그려 사진이나 파일로 올려 주세요.", "", true],
    ["1", "코드제출(학생제작)", "본인이 제작한 코드를 올려주세요(html형식).", "", true]
  ];
  // 공개 칸 체크박스가 200행까지 미리 깔려 있어서 appendRow를 쓰면 201행으로 내려가요.
  // 그래서 과제명(B열)이 비어 있는 첫 줄을 찾아 그 자리에 적습니다.
  var lastRow = Math.max(t.getLastRow(), 1);
  var titles = lastRow > 1 ? t.getRange(2, 2, lastRow - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  DEFAULT_TASKS.forEach(function (row) {
    if (titles.indexOf(row[1]) >= 0) return;
    var idx = titles.indexOf("");
    if (idx < 0) { idx = titles.length; titles.push(""); }
    var r = idx + 2;
    t.getRange(r, 1, 1, 4).setValues([row.slice(0, 4)]);
    t.getRange(r, 5).insertCheckboxes().setValue(row[4]);
    titles[idx] = row[1];
  });
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
    if (p.action === "gallery") {
      if (!galleryCodeOk_(p.code)) return json_({ ok: false, locked: true, error: "입장 코드가 맞지 않아요." });
      return json_({ ok: true, items: galleryList_(false) });
    }
    if (p.action === "gallery_file") return galleryFile_(p);
    if (p.action === "gallery_mine") {
      if (String(p.code) !== SUBMIT_CODE) return json_({ ok: false, error: "제출코드가 맞지 않아요." });
      return json_({ ok: true, items: galleryRows_().filter(function (r) {
        return r.grade === String(p.grade) && r.cls === String(p.cls) && r.num === String(p.num);
      }).map(function (r) { return galleryOut_(r, true); }) });
    }
    if (p.action === "gallery_admin") {
      if (String(p.tcode) !== TEACHER_CODE) return json_({ ok: false, error: "교사 코드가 맞지 않아요." });
      return json_({ ok: true, needApproval: GALLERY_NEED_APPROVAL, items: galleryRows_().map(function (r) {
        var o = galleryOut_(r, true); o.url = r.url; return o; }) });
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
    if (d.action === "gallery_upload") return galleryUpload_(d);
    if (d.action === "gallery_set") return gallerySet_(d);
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
      return json_({ ok: false, error: "jpg, png, pdf, doc(x), hwp(x), ino, py, txt, html 파일만 올릴 수 있어요." });
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

    var mime = CODE_EXT.indexOf(ext) >= 0 ? "text/plain" : (d.mimeType || "application/octet-stream");
    var blob = Utilities.newBlob(bytes, mime, fileName);
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

/* =================== 학생 개발자료 게시판 =================== */
var GALLERY_NEED_APPROVAL = true;      // true: 선생님이 공개해야 보임 / false: 올리면 바로 공개
var GALLERY_NAME_STYLE = "mask";       // "mask" 유○석 / "full" 유민석 / "none" 이름 숨김
// 게시판 입장 코드: 이 코드(또는 제출코드·교사코드)를 입력해야 목록을 보고 내려받을 수 있어요.
// 비워 두면 제출코드(SUBMIT_CODE)로 입장합니다.
var GALLERY_VIEW_CODE = "";
var GALLERY_MAX_BYTES = 5 * 1024 * 1024;
var GALLERY_FOLDER = "개발자료게시판";
var GALLERY_SHEET = "개발자료게시판";
var GALLERY_HEADER = ["게시ID", "등록시각", "학년", "반", "번호", "이름", "제목", "설명", "파일명", "크기(KB)", "공개", "다운로드", "파일 링크", "파일ID", "구분"];
var G_OPEN_COL = 11, G_DL_COL = 12;
// 선생님 자료: 교사 코드로 올리면 바로 공개, 여러 형식 가능
var TEACHER_MAX_BYTES = 20 * 1024 * 1024;
var TEACHER_EXT = ["html", "htm", "pdf", "hwp", "hwpx", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "jpg", "jpeg", "png", "gif", "txt", "py", "ino", "csv", "mp3", "mp4"];
var TEXT_EXT = ["html", "htm", "txt", "py", "ino", "csv"];

function gallerySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(GALLERY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(GALLERY_SHEET);
    sh.appendRow(GALLERY_HEADER);
    sh.setFrozenRows(1);
    sh.setColumnWidth(7, 220); sh.setColumnWidth(8, 320);
  } else if (sh.getLastColumn() < GALLERY_HEADER.length) {
    sh.getRange(1, 1, 1, GALLERY_HEADER.length).setValues([GALLERY_HEADER]); // 새 열(구분) 추가
  }
  return sh;
}

function galleryRows_() {
  var sh = gallerySheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, GALLERY_HEADER.length).getValues().map(function (r, i) {
    return {
      row: i + 2, id: String(r[0]), time: r[1] instanceof Date ? fmtDate_(r[1]) : String(r[1]),
      grade: String(r[2]), cls: String(r[3]), num: String(r[4]), name: String(r[5]),
      title: String(r[6]), desc: String(r[7]), file: String(r[8]), kb: Number(r[9]) || 0,
      open: r[10] === true || String(r[10]).toUpperCase() === "TRUE",
      dl: Number(r[11]) || 0, url: String(r[12]), fileId: String(r[13]),
      teacher: String(r[14]) === "선생님"
    };
  }).filter(function (r) { return r.id; });
}

function galleryCodeOk_(c) {
  c = String(c || "");
  if (!c) return false;
  return c === SUBMIT_CODE || c === TEACHER_CODE || (!!GALLERY_VIEW_CODE && c === GALLERY_VIEW_CODE);
}

function galleryName_(name) {
  name = String(name || "");
  if (GALLERY_NAME_STYLE === "full") return name;
  if (GALLERY_NAME_STYLE === "none" || !name) return "";
  if (name.length <= 2) return name.charAt(0) + "○";
  return name.charAt(0) + new Array(name.length - 1).join("○") + name.charAt(name.length - 1);
}

function galleryOut_(r, full) {
  return {
    id: r.id, time: r.time, grade: r.grade, who: r.teacher ? "선생님" : (full ? r.name : galleryName_(r.name)),
    title: r.title, desc: r.desc, file: r.file, kb: r.kb, dl: r.dl, open: r.open, teacher: r.teacher
  };
}

function galleryList_() {
  return galleryRows_().filter(function (r) { return r.open; }).map(function (r) { return galleryOut_(r, false); }).reverse();
}

// GET ?action=gallery_file&id=게시ID[&dl=1][&tcode=교사코드]
//   → 글자 파일(html 등)은 content, 그 밖의 파일은 b64(base64) + mime
function galleryFile_(p) {
  var rows = galleryRows_(), r = null;
  rows.forEach(function (x) { if (x.id === String(p.id)) r = x; });
  var teacher = p.tcode && String(p.tcode) === TEACHER_CODE;
  if (!teacher && !galleryCodeOk_(p.code)) return json_({ ok: false, locked: true, error: "입장 코드가 맞지 않아요." });
  if (!r || (!r.open && !teacher)) return json_({ ok: false, error: "공개된 자료가 아니에요." });
  var blob = DriveApp.getFileById(r.fileId).getBlob();
  var ext = (r.file.split(".").pop() || "").toLowerCase();
  var out = { ok: true, fileName: r.file };
  if (TEXT_EXT.indexOf(ext) >= 0) out.content = blob.getDataAsString("UTF-8");
  else { out.b64 = Utilities.base64Encode(blob.getBytes()); out.mime = blob.getContentType() || "application/octet-stream"; }
  if (String(p.dl) === "1" && !teacher) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sh = gallerySheet_();
      var cur = Number(sh.getRange(r.row, G_DL_COL).getValue()) || 0;
      sh.getRange(r.row, G_DL_COL).setValue(cur + 1);
    } catch (x) {} finally { try { lock.releaseLock(); } catch (y) {} }
  }
  return json_(out);
}

// POST {action:"gallery_upload", code, grade, cls, num, name, title, desc, fileName, data(base64)}
function galleryUpload_(d) {
  if (d.tcode) return galleryTeacherUpload_(d);
  var lock = null;
  try {
    if (String(d.code) !== SUBMIT_CODE) return json_({ ok: false, error: "제출코드가 맞지 않아요." });
    var grade = String(d.grade), cls = String(d.cls), num = String(d.num);
    var name = ROSTER[grade] && ROSTER[grade][cls] && ROSTER[grade][cls][num];
    if (!name || name !== String(d.name)) return json_({ ok: false, error: "명단에 없는 학생이에요." });
    var title = String(d.title || "").replace(/[\r\n]+/g, " ").trim().slice(0, 60);
    var desc = String(d.desc || "").trim().slice(0, 500);
    if (!title) return json_({ ok: false, error: "작품 제목을 적어 주세요." });
    var orig = safeName_(d.fileName || "work.html");
    var ext = (orig.split(".").pop() || "").toLowerCase();
    if (orig.indexOf(".") < 0 || (ext !== "html" && ext !== "htm")) return json_({ ok: false, error: "html 파일만 올릴 수 있어요." });
    var bytes = Utilities.base64Decode(String(d.data || ""));
    if (!bytes.length) return json_({ ok: false, error: "빈 파일이에요." });
    if (bytes.length > GALLERY_MAX_BYTES) return json_({ ok: false, error: "파일이 5MB보다 커요." });

    var now = new Date();
    var folder = getSubFolder_(getSubFolder_(getRootFolder_(), GALLERY_FOLDER), grade + "학년");
    var base = grade + "-" + cls + "_" + pad2_(num) + "_" + name + "_" + orig.replace(/\.[^.]+$/, "");
    var fileName = base + "." + ext, k = 2;
    while (folder.getFilesByName(fileName).hasNext()) fileName = base + "(" + (k++) + ")." + ext;
    // 드라이브에서 실행되지 않도록 일반 텍스트로 저장
    var file = folder.createFile(Utilities.newBlob(bytes, "text/plain", fileName));

    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var sh = gallerySheet_();
    var id = "G" + now.getTime().toString(36);
    var open = !GALLERY_NEED_APPROVAL;
    // 수식으로 해석되지 않도록 학생이 적은 글 앞에 ' 를 붙임
    var safe = function (t) { return /^[=+\-@]/.test(t) ? "'" + t : t; };
    sh.appendRow([id, now, grade, cls, num, name, safe(title), safe(desc), orig, Math.round(bytes.length / 1024), open, 0, file.getUrl(), file.getId(), "학생"]);
    sh.getRange(sh.getLastRow(), G_OPEN_COL).insertCheckboxes().setValue(open);
    return json_({ ok: true, id: id, open: open, time: fmtDate_(now) });
  } catch (err) {
    return json_({ ok: false, error: "저장 중 오류: " + String(err) });
  } finally {
    if (lock) try { lock.releaseLock(); } catch (x) {}
  }
}

// POST {action:"gallery_set", tcode, id, open:true|false}
function gallerySet_(d) {
  if (String(d.tcode) !== TEACHER_CODE) return json_({ ok: false, error: "교사 코드가 맞지 않아요." });
  var r = null;
  galleryRows_().forEach(function (x) { if (x.id === String(d.id)) r = x; });
  if (!r) return json_({ ok: false, error: "게시물을 찾지 못했어요." });
  gallerySheet_().getRange(r.row, G_OPEN_COL).setValue(!!d.open);
  return json_({ ok: true, id: r.id, open: !!d.open });
}

// POST {action:"gallery_upload", tcode, grade:"all"|"1"|"2"|"3", title, desc, fileName, mimeType, data(base64)}
// 선생님 자료: 바로 공개, 목록 맨 위에 고정
function galleryTeacherUpload_(d) {
  var lock = null;
  try {
    if (String(d.tcode) !== TEACHER_CODE) return json_({ ok: false, error: "교사 코드가 맞지 않아요." });
    var grade = ["all", "1", "2", "3"].indexOf(String(d.grade)) >= 0 ? String(d.grade) : "all";
    var title = String(d.title || "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
    var desc = String(d.desc || "").trim().slice(0, 1000);
    if (!title) return json_({ ok: false, error: "자료 제목을 적어 주세요." });
    var orig = safeName_(d.fileName || "file");
    var ext = (orig.split(".").pop() || "").toLowerCase();
    if (orig.indexOf(".") < 0 || TEACHER_EXT.indexOf(ext) < 0) return json_({ ok: false, error: "올릴 수 없는 파일 형식이에요: " + ext });
    var bytes = Utilities.base64Decode(String(d.data || ""));
    if (!bytes.length) return json_({ ok: false, error: "빈 파일이에요." });
    if (bytes.length > TEACHER_MAX_BYTES) return json_({ ok: false, error: "파일이 20MB보다 커요." });

    var now = new Date();
    var folder = getSubFolder_(getSubFolder_(getRootFolder_(), GALLERY_FOLDER), "선생님");
    var base = orig.replace(/\.[^.]+$/, ""), fileName = orig, k = 2;
    while (folder.getFilesByName(fileName).hasNext()) fileName = base + "(" + (k++) + ")." + ext;
    var mime = TEXT_EXT.indexOf(ext) >= 0 ? "text/plain" : (String(d.mimeType || "") || "application/octet-stream");
    var file = folder.createFile(Utilities.newBlob(bytes, mime, fileName));

    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var sh = gallerySheet_();
    var id = "T" + now.getTime().toString(36);
    var safe = function (t) { return /^[=+\-@]/.test(t) ? "'" + t : t; };
    sh.appendRow([id, now, grade, "", "", "선생님", safe(title), safe(desc), orig, Math.round(bytes.length / 1024), true, 0, file.getUrl(), file.getId(), "선생님"]);
    sh.getRange(sh.getLastRow(), G_OPEN_COL).insertCheckboxes().setValue(true);
    return json_({ ok: true, id: id, open: true, time: fmtDate_(now) });
  } catch (err) {
    return json_({ ok: false, error: "저장 중 오류: " + String(err) });
  } finally {
    if (lock) try { lock.releaseLock(); } catch (x) {}
  }
}
