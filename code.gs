/**
 * 아화중학교 과학 워크시트 제출 → 구글 스프레드시트 저장용 Apps Script
 * ------------------------------------------------------------------
 * 이 저장소의 모든 워크시트(state-change-energy.html, state-change-summary.html,
 * mul-teukseong.html, sepo-bupi-pyomyeonjeok.html 등)가 같은 웹 앱 주소를
 * 공유해서 쓸 수 있도록 만든 범용 스크립트입니다.
 *
 * 각 워크시트가 보내는 payload의 키(필드명)가 서로 달라도, 제출된 값을
 * 그대로 열로 만들어 기록합니다. payload에 "worksheet" 값이 있으면 그
 * 이름의 시트 탭에, 없으면 "기타" 탭에 기록됩니다.
 *
 * ▣ 설치 방법
 * 1) 구글 스프레드시트를 새로 만듭니다. (탭은 자동으로 생성되니 미리 만들
 *    필요 없습니다.)
 * 2) 확장 프로그램 → Apps Script 를 열고, 기본 코드를 지운 뒤 이 파일의
 *    내용을 전체 붙여넣고 저장합니다. (파일 이름은 원하는 대로 둬도 됩니다.)
 * 3) 배포 → 새 배포 → 유형: 웹 앱
 *      - 실행 대상: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자
 *    로 설정하고 배포한 뒤, 발급된 웹 앱 URL을 복사합니다.
 * 4) 각 워크시트 html 파일 하단의
 *      const SPREADSHEET_WEBHOOK_URL = "";
 *    에 그 주소를 붙여넣습니다. (여러 워크시트에 같은 주소를 써도 됩니다.)
 * 5) 워크시트 내용을 수정해서 새 문항이 생기면, 코드 수정 없이도 새 열이
 *    헤더 뒤쪽에 자동으로 추가됩니다.
 *
 * ※ 참고: mul-teukseong.html은 아직 "worksheet" 값을 보내지 않아서
 *   "기타" 탭에 기록됩니다. 워크시트별로 탭을 분리하고 싶다면 해당 파일의
 *   제출 payload에 worksheet: "1_mul_teukseong" 같은 값을 추가해 주세요.
 *
 * ▣ 공유 랭킹(기울기 미로 게임, 비행기 슈팅 게임)에 대해
 * 이 스크립트는 GET ?worksheet=시트이름 요청에도 응답해서, 여러 학생
 * 기기가 같은 탭의 기록을 함께 읽을 수 있습니다(반 전체가 공유하는
 * 랭킹판). 이미 이 URL을 쓰고 있다면 기존 배포를 "새 버전"으로
 * 업데이트하기만 하면 됩니다(주소는 그대로 유지됨):
 *   배포 → 배포 관리 → (연필 아이콘) 수정 → 버전: 새 버전 → 배포
 * 새로 설치하는 경우에는 위 1~4번 설치 방법을 그대로 따르면 됩니다.
 *
 * ▣ 교사 대시보드(worksheet-dashboard.html)
 * 맨 아래 DASHBOARD_KEY 에 교사 코드를 정해 적고 "새 버전"으로 배포하면,
 * 스프레드시트를 열지 않고도 대시보드에서 학생 답안을 볼 수 있어요.
 * (교사 코드가 맞아야만 답안을 돌려줍니다.)
 *
 * ▣ 파티게임방(student-dev/party-games.html) 온라인 방
 * 같은 웹 앱 주소로 pg=… 요청이 오면 파티게임방의 방 상태를 주고받습니다.
 * 방 데이터는 시트가 아니라 Apps Script 캐시(CacheService)에 저장되어
 * 스프레드시트에 탭이 생기지 않고, 마지막 활동 후 6시간이 지나면 자동으로 사라집니다.
 */

function doPost(e) {
  if (e && e.parameter && e.parameter.pg) return pgPost_(e.parameter);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = (e && e.parameter) || {};

  var sheetName = d.worksheet || "기타";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // 항상 맨 앞에 둘 컬럼 / 항상 맨 뒤에 둘 컬럼
  var fixedFront = ["grade", "classNum", "number", "name"];
  var fixedBack = ["score", "total"];

  var incomingKeys = Object.keys(d).filter(function (k) {
    return k !== "worksheet";
  });
  var middleKeys = incomingKeys
    .filter(function (k) {
      return fixedFront.indexOf(k) === -1 && fixedBack.indexOf(k) === -1;
    })
    .sort();

  var columns = ["timestamp"].concat(fixedFront, middleKeys, fixedBack);

  if (sheet.getLastRow() === 0) {
    // 새 시트: 헤더를 새로 씀
    sheet.appendRow(columns);
  } else {
    // 기존 시트: 지금까지 없던 새 컬럼(새로 추가된 문항 등)이 있으면 뒤에 이어붙임
    var lastCol = sheet.getLastColumn();
    var existingHeader = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var newCols = columns.filter(function (c) {
      return existingHeader.indexOf(c) === -1;
    });
    if (newCols.length > 0) {
      sheet.getRange(1, lastCol + 1, 1, newCols.length).setValues([newCols]);
      existingHeader = existingHeader.concat(newCols);
    }
    columns = existingHeader;
  }

  var row = columns.map(function (col) {
    if (col === "timestamp") return new Date();
    return d[col] !== undefined ? d[col] : "";
  });

  sheet.appendRow(row);

  return ContentService.createTextOutput("OK");
}

/**
 * GET ?worksheet=시트이름 으로 호출하면 그 탭의 모든 행을 JSON 배열로
 * 돌려준다(헤더를 키로 사용). 랭킹처럼 "여러 학생 기기가 공유해서 읽어야
 * 하는" 데이터를 보여줄 때 쓴다. worksheet 파라미터가 없으면 기존처럼
 * 안내 문구만 반환한다.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.pg) return pgGet_(e.parameter);
  if (e && e.parameter && e.parameter.action === "dash") return dash_(e.parameter);
  var worksheet = (e && e.parameter && e.parameter.worksheet) || "";
  if (!worksheet) {
    return ContentService.createTextOutput(
      "이 웹 앱은 아화중학교 과학 워크시트 제출 데이터를 받는 용도입니다. POST 요청으로 사용해 주세요."
    );
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(worksheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var rows = values.slice(1).map(function (row) {
    var obj = {};
    header.forEach(function (col, i) {
      var v = row[i];
      obj[col] = v instanceof Date ? v.toISOString() : v;
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===================== 파티게임방 온라인 방 ===================== */
var PG_TTL = 21600;        // 캐시 보관 시간(초) — 6시간(최대값), 활동할 때마다 연장
var PG_MAX = 60000;        // 방 하나의 최대 크기(글자 수, 캐시 한도 100KB 안쪽)
var PG_MAX_PLAYERS = 12;

function pgOut_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function pgCode_(c) {
  c = String(c || "").toUpperCase();
  if (!/^[A-Z0-9가-힣]{4}$/.test(c)) throw new Error("방 코드가 올바르지 않아요");
  return c;
}
function pgLoad_(code) {
  var s = CacheService.getScriptCache().get("pg_" + code);
  return s ? JSON.parse(s) : null;
}
function pgRoomOut_(room) {
  return pgOut_({ ok: true, v: room.v, main: room.main, players: room.players });
}

// GET ?pg=ping  /  GET ?pg=room&code=ABCD&v=마지막버전
function pgGet_(p) {
  try {
    if (p.pg === "ping") return pgOut_({ ok: true, pg: 1 });
    var room = pgLoad_(pgCode_(p.code));
    if (!room) return pgOut_({ ok: true, v: 0, main: null, players: {} });
    if (p.v && Number(p.v) === room.v) return pgOut_({ ok: true, same: 1, v: room.v });
    return pgRoomOut_(room);
  } catch (err) {
    return pgOut_({ ok: false, error: String(err && err.message || err) });
  }
}

// POST pg=w, op=set|del, path=parties/CODE 또는 parties/CODE/players/ID, data=JSON
function pgPost_(p) {
  try {
    var parts = String(p.path || "").split("/");
    if (parts[0] !== "parties" || !(parts.length === 2 || (parts.length === 4 && parts[2] === "players")))
      throw new Error("경로가 올바르지 않아요");
    var code = pgCode_(parts[1]);
    var id = parts[3];
    if (id !== undefined && !/^[A-Za-z0-9_-]{1,20}$/.test(id)) throw new Error("참가자 ID가 올바르지 않아요");
    var data = null;
    if (p.op === "set") {
      if (String(p.data || "").length > PG_MAX) throw new Error("데이터가 너무 커요");
      data = JSON.parse(p.data);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("데이터 형식이 올바르지 않아요");
    } else if (p.op !== "del") {
      throw new Error("알 수 없는 요청이에요");
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var cache = CacheService.getScriptCache();
      var room = pgLoad_(code) || { v: 0, main: null, players: {} };
      if (id === undefined) {
        room.main = data;
      } else if (data) {
        if (!room.players[id] && Object.keys(room.players).length >= PG_MAX_PLAYERS)
          throw new Error("방이 꽉 찼어요");
        room.players[id] = data;
      } else {
        delete room.players[id];
      }
      room.v = Math.max((room.v || 0) + 1, Date.now()); // 방을 지웠다 다시 만들어도 버전이 거꾸로 가지 않게
      if (!room.main && Object.keys(room.players).length === 0) {
        cache.remove("pg_" + code);
      } else {
        var s = JSON.stringify(room);
        if (s.length > PG_MAX) throw new Error("방 데이터가 너무 커요");
        cache.put("pg_" + code, s, PG_TTL);
      }
      return pgRoomOut_(room);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return pgOut_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ===================== 교사 대시보드(워크시트 답안 보기) =====================
 * worksheet-dashboard.html 이 GET ?action=dash&key=교사코드 로 탭 목록을,
 * ?action=dash&key=교사코드&sheet=탭이름 으로 그 탭의 답안을 읽어 갑니다.
 * 아래 DASHBOARD_KEY 를 정해 적은 뒤 "새 버전"으로 배포해야 대시보드가 열려요.
 * ※ 이 저장소에 올라간 파일에는 실제 코드를 적지 않습니다.
 */
var DASHBOARD_KEY = "여기에_교사_확인코드";   // 예: "482915"
var DASH_SKIP_ = { "AI조사_기록": true };      // 대시보드 목록에서 뺄 탭

function dashOut_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function dashCell_(v) { return v instanceof Date ? v.toISOString() : v; }

function dash_(p) {
  if (!DASHBOARD_KEY || DASHBOARD_KEY.indexOf("여기에") === 0) return dashOut_({ ok: false, error: "setup" });
  if (String(p.key || "") !== DASHBOARD_KEY) return dashOut_({ ok: false, error: "key" });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!p.sheet) {
    var list = ss.getSheets().filter(function (sh) { return !DASH_SKIP_[sh.getName()]; }).map(function (sh) {
      var n = sh.getLastRow();
      var last = n >= 2 ? dashCell_(sh.getRange(n, 1).getValue()) : "";
      return { name: sh.getName(), rows: Math.max(n - 1, 0), last: last };
    });
    return dashOut_({ ok: true, sheets: list });
  }
  var sheet = ss.getSheetByName(String(p.sheet));
  if (!sheet) return dashOut_({ ok: false, error: "nosheet" });
  if (sheet.getLastRow() < 1) return dashOut_({ ok: true, sheet: sheet.getName(), header: [], rows: [] });
  var values = sheet.getDataRange().getValues();
  return dashOut_({
    ok: true,
    sheet: sheet.getName(),
    header: values[0].map(String),
    rows: values.slice(1).map(function (r) { return r.map(dashCell_); })
  });
}
