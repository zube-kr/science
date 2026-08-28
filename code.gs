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
 */

function doPost(e) {
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

function doGet(e) {
  return ContentService.createTextOutput(
    "이 웹 앱은 아화중학교 과학 워크시트 제출 데이터를 받는 용도입니다. POST 요청으로 사용해 주세요."
  );
}
