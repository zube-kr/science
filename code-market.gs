/**
 * 아화중학교 상점마켓 — 운영 현황 Apps Script
 * ------------------------------------------------------------------
 * sangjeom-market.html 에서
 *   - 학생: 고유 코드(4자리)로 자기 상점·벌점·사용한 상점·잔여 상점 조회
 *   - 관리자: 관리자 코드(6자리)로 스쿨라이프 엑셀 반영, 상점 사용(차감) 기록,
 *            상품 목록 관리, 학생 코드표 확인
 * 을 할 수 있도록 이 스프레드시트에 자료를 저장합니다.
 *
 * ▣ 계산 방법
 *   평점      = 상점 − 벌점          (스쿨라이프 엑셀의 11/13 이후 누적 상점·벌점)
 *   잔여 상점 = 평점 − 사용한 상점   (상품으로 바꿀 때 관리자가 기록한 점수의 합)
 *   ※ 엑셀의 이월·회복·지도차감·평점(누계) 숫자는 쓰지 않습니다.
 *
 * ▣ 설치 방법 (처음 한 번)
 * 1) 구글 스프레드시트를 새로 만듭니다. (이름 예: 아화중_상점마켓)
 * 2) 확장 프로그램 → Apps Script 를 열고, 기본 코드를 지운 뒤 이 파일의
 *    내용을 전체 붙여넣고 저장합니다.
 * 3) 아래 ADMIN_CODE 에 관리자 접속코드(숫자 6자리)를 적습니다.
 *    ※ 이 저장소에 올라간 파일에는 실제 코드를 적지 않습니다.
 * 4) 위쪽 함수 선택 칸에서 setup 을 고르고 [실행] → 권한 허용.
 *    "학생", "사용기록", "상품", "업로드기록" 탭이 자동으로 만들어집니다.
 * 5) 배포 → 새 배포 → 유형: 웹 앱
 *      - 실행 대상: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자
 *    로 배포하고, 발급된 웹 앱 URL(…/exec)을 sangjeom-market.html 의
 *      const MARKET_API = "";
 *    에 넣습니다.
 *
 * ▣ 학생 코드
 *   엑셀을 처음 반영할 때 학생마다 겹치지 않는 4자리 코드(1000~9999)가
 *   자동으로 만들어져 "학생" 탭의 코드 칸에 저장됩니다.
 *   관리자 화면의 [코드표 인쇄]로 학생에게 나눠 줄 쪽지를 인쇄할 수 있어요.
 *
 * ▣ 코드를 수정했을 때
 *   배포 → 배포 관리 → (연필) → 버전: 새 버전 → 배포  (주소는 그대로 유지)
 */

var ADMIN_CODE = "여기에_관리자코드_6자리";   // 예: "123456" (숫자 6자리)

var TZ = "Asia/Seoul";
var SHEETS = {
  students: { name: "학생",       head: ["키", "학년", "반", "번호", "이름", "코드", "상점", "벌점", "마지막반영"] },
  uses:     { name: "사용기록",   head: ["ID", "일시", "키", "이름", "사용점수", "내용"] },
  products: { name: "상품",       head: ["상품명", "필요점수", "비고"] },
  uploads:  { name: "업로드기록", head: ["일시", "파일명", "기간", "학생수", "새학생", "변경"] }
};

/* ---------------- 진입점 ---------------- */
function setup() {
  Object.keys(SHEETS).forEach(function (k) { sheet_(k); });
}

function doGet() {
  return json_({ ok: true, msg: "상점마켓 서버가 동작 중입니다." });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, error: "잘못된 요청입니다." }); }
  try {
    switch (req.action) {
      case "student":      return json_(student_(req));
      case "admin":        admin_(req); return json_(adminData_());
      case "upload":       admin_(req); return json_(locked_(function () { return upload_(req); }));
      case "addUse":       admin_(req); return json_(locked_(function () { return addUse_(req); }));
      case "deleteUse":    admin_(req); return json_(locked_(function () { return deleteUse_(req); }));
      case "saveProducts": admin_(req); return json_(locked_(function () { return saveProducts_(req); }));
      case "newCode":      admin_(req); return json_(locked_(function () { return newCode_(req); }));
      default:             return json_({ ok: false, error: "알 수 없는 요청입니다." });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------------- 공통 ---------------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function now_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"); }
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm");
  return v === null || v === undefined ? "" : String(v);
}
function int_(v) { var n = Math.round(Number(String(v).replace(/,/g, ""))); return isFinite(n) ? n : 0; }

function sheet_(key) {
  var def = SHEETS[key], ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function rows_(key) {
  var sh = sheet_(key), n = sh.getLastRow() - 1, w = SHEETS[key].head.length;
  return n > 0 ? sh.getRange(2, 1, n, w).getValues() : [];
}
function locked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// 코드를 마구 눌러 맞히는 것을 막기 위한 간단한 제한 (10분 동안 실패 횟수)
function tooMany_(kind, limit) {
  var c = CacheService.getScriptCache(), n = Number(c.get("fail_" + kind) || 0);
  return n >= limit;
}
function failed_(kind) {
  var c = CacheService.getScriptCache(), k = "fail_" + kind, n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), 600);
}

function admin_(req) {
  if (!/^\d{6}$/.test(ADMIN_CODE)) throw new Error("Apps Script의 ADMIN_CODE를 숫자 6자리로 먼저 정해 주세요.");
  if (tooMany_("admin", 15)) throw new Error("관리자 코드가 여러 번 틀려서 10분 동안 잠겼어요. 잠시 후 다시 해 주세요.");
  if (String(req.adminCode || "") !== ADMIN_CODE) { failed_("admin"); throw new Error("관리자 코드가 맞지 않아요."); }
}

/* ---------------- 자료 읽기 ---------------- */
function students_() {
  return rows_("students").map(function (r, i) {
    return {
      row: i + 2, key: str_(r[0]), grade: int_(r[1]), cls: int_(r[2]), num: int_(r[3]), name: str_(r[4]),
      code: str_(r[5]), plus: int_(r[6]), minus: int_(r[7]), updated: str_(r[8])
    };
  }).filter(function (s) { return s.key; });
}
function uses_() {
  return rows_("uses").map(function (r, i) {
    return { row: i + 2, id: str_(r[0]), date: str_(r[1]), key: str_(r[2]), name: str_(r[3]), points: int_(r[4]), memo: str_(r[5]) };
  }).filter(function (u) { return u.id; });
}
function products_() {
  return rows_("products").map(function (r) { return { name: str_(r[0]), cost: int_(r[1]), note: str_(r[2]) }; })
    .filter(function (p) { return p.name; })
    .sort(function (a, b) { return a.cost - b.cost; });
}
function usedMap_(uses) {
  var m = {};
  uses.forEach(function (u) { m[u.key] = (m[u.key] || 0) + u.points; });
  return m;
}
function withTotals_(s, used) {
  var score = s.plus - s.minus;
  return { key: s.key, grade: s.grade, cls: s.cls, num: s.num, name: s.name, code: s.code,
           plus: s.plus, minus: s.minus, score: score, used: used || 0, remain: score - (used || 0), updated: s.updated };
}
function lastUpload_() {
  var r = rows_("uploads");
  if (!r.length) return null;
  var x = r[r.length - 1];
  return { date: str_(x[0]), file: str_(x[1]), period: str_(x[2]), count: int_(x[3]) };
}

/* ---------------- 학생 조회 ---------------- */
function student_(req) {
  var code = String(req.code || "").trim();
  if (!/^\d{4}$/.test(code)) return { ok: false, error: "코드는 숫자 4자리예요." };
  if (tooMany_("student", 80)) return { ok: false, error: "잘못된 코드 입력이 너무 많아요. 10분 뒤에 다시 해 주세요." };
  var s = students_().filter(function (x) { return x.code === code; })[0];
  if (!s) { failed_("student"); return { ok: false, error: "등록되지 않은 코드예요. 코드를 다시 확인해 주세요." }; }
  var mine = uses_().filter(function (u) { return u.key === s.key; });
  var used = mine.reduce(function (a, u) { return a + u.points; }, 0);
  var me = withTotals_(s, used);
  delete me.code; delete me.key;
  return {
    ok: true, student: me,
    uses: mine.map(function (u) { return { date: u.date, points: u.points, memo: u.memo }; }).reverse(),
    products: products_(), lastUpload: lastUpload_()
  };
}

/* ---------------- 관리자 ---------------- */
function adminData_() {
  var uses = uses_(), m = usedMap_(uses);
  var list = students_().map(function (s) { return withTotals_(s, m[s.key]); })
    .sort(function (a, b) { return a.grade - b.grade || a.cls - b.cls || a.num - b.num; });
  var up = rows_("uploads").slice(-10).reverse().map(function (x) {
    return { date: str_(x[0]), file: str_(x[1]), period: str_(x[2]), count: int_(x[3]), added: int_(x[4]), changed: int_(x[5]) };
  });
  return {
    ok: true, students: list,
    uses: uses.map(function (u) { return { id: u.id, date: u.date, key: u.key, name: u.name, points: u.points, memo: u.memo }; }).reverse(),
    products: products_(), uploads: up
  };
}

function newUniqueCode_(taken) {
  for (var i = 0; i < 2000; i++) {
    var c = String(1000 + Math.floor(Math.random() * 9000));
    if (!taken[c]) { taken[c] = true; return c; }
  }
  throw new Error("새 코드를 만들지 못했어요.");
}

function upload_(req) {
  var rows = Array.isArray(req.rows) ? req.rows : [];
  if (!rows.length) throw new Error("엑셀에서 읽은 학생이 없어요.");
  if (rows.length > 2000) throw new Error("학생 수가 너무 많아요.");
  var sh = sheet_("students"), list = students_(), byKey = {}, taken = {};
  list.forEach(function (s) { byKey[s.key] = s; taken[s.code] = true; });
  var stamp = now_(), added = 0, changed = 0, seen = {};
  rows.forEach(function (r) {
    var grade = int_(r.grade), cls = int_(r.cls), num = int_(r.num), name = String(r.name || "").trim().slice(0, 20);
    if (!name || !grade) return;
    var key = grade + "-" + cls + "-" + num + "-" + name;
    if (seen[key]) return;
    seen[key] = true;
    var plus = Math.abs(int_(r.plus)), minus = Math.abs(int_(r.minus));
    var s = byKey[key];
    if (s) {
      if (s.plus !== plus || s.minus !== minus) changed++;
      sh.getRange(s.row, 7, 1, 3).setValues([[plus, minus, stamp]]);
    } else {
      sh.appendRow([key, grade, cls, num, name, newUniqueCode_(taken), plus, minus, stamp]);
      added++;
    }
  });
  sheet_("uploads").appendRow([stamp, String(req.fileName || "").slice(0, 80), String(req.period || "").slice(0, 40), Object.keys(seen).length, added, changed]);
  var data = adminData_();
  data.result = { count: Object.keys(seen).length, added: added, changed: changed };
  return data;
}

function addUse_(req) {
  var key = String(req.key || ""), points = int_(req.points), memo = String(req.memo || "").trim().slice(0, 60);
  if (points <= 0 || points > 10000) throw new Error("사용 점수는 1 이상의 정수로 적어 주세요.");
  var s = students_().filter(function (x) { return x.key === key; })[0];
  if (!s) throw new Error("학생을 찾지 못했어요.");
  var used = uses_().filter(function (u) { return u.key === key; }).reduce(function (a, u) { return a + u.points; }, 0);
  var remain = s.plus - s.minus - used;
  if (points > remain && !req.force) {
    return { ok: false, needForce: true, remain: remain, error: s.name + " 학생의 잔여 상점은 " + remain + "점이에요." };
  }
  var id = "U" + new Date().getTime() + Math.floor(Math.random() * 1000);
  sheet_("uses").appendRow([id, now_(), key, s.name, points, memo]);
  return adminData_();
}

function deleteUse_(req) {
  var u = uses_().filter(function (x) { return x.id === String(req.id || ""); })[0];
  if (!u) throw new Error("이미 지워졌거나 없는 기록이에요.");
  sheet_("uses").deleteRow(u.row);
  return adminData_();
}

function saveProducts_(req) {
  var list = (Array.isArray(req.products) ? req.products : []).map(function (p) {
    return [String(p.name || "").trim().slice(0, 40), Math.max(0, int_(p.cost)), String(p.note || "").trim().slice(0, 60)];
  }).filter(function (p) { return p[0]; }).slice(0, 100);
  var sh = sheet_("products"), n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 3).clearContent();
  if (list.length) sh.getRange(2, 1, list.length, 3).setValues(list);
  return adminData_();
}

function newCode_(req) {
  var list = students_(), taken = {};
  list.forEach(function (s) { taken[s.code] = true; });
  var s = list.filter(function (x) { return x.key === String(req.key || ""); })[0];
  if (!s) throw new Error("학생을 찾지 못했어요.");
  sheet_("students").getRange(s.row, 6).setValue(newUniqueCode_(taken));
  return adminData_();
}
