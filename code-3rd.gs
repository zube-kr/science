/**
 * 아화중학교 3학년 과학 워크시트 - 답안 저장용 Apps Script
 * (스프레드시트 이름: 아화중_중3_워크시트)
 *
 * 3학년 워크시트(시차 측정하기, 별의 밝기, 별의 색, 은하수와 우리은하,
 * 성단과 성운, 팽창하는 우주 등)의 제출을 하나의 배포/스프레드시트로 받아서,
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
             "교사피드백"],
    row: function (data) {
      return [
        data.distOne || "", data.distFour || "", data.distNine || "",
        data.areaDistanceRelation || "", data.brightnessRelation || "",
        data.q1Selected || "", data.q2Selected || "",
        data.magBright || "", data.magDim || "", data.mag100x || "", data.mag25x || "", data.magPcDef || "",
        data.ox1 || "", data.ox2 || "", data.ox3 || "",
        data.apparentOrder || "", data.realOrder || "", data.dragFinalState || "",
        data.caniMatch41 || "", data.caniMatch20 || "", data.caniMatchNeg14 || ""
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

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
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
