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
// 책마다 따로 저장한다 (같은 학생이 두 책 워크시트를 써도 서로 덮어쓰지 않게)
const BOOKS = {
  naro:   { title: "나는 나로 살기로 했다", save: SAVE_SHEET },
  spring: { title: "침묵의 봄", save: "질문탐구_저장_침묵의봄" }
};
const bookOf_ = function (data) { return BOOKS[String(data && data.book || "")] ? String(data.book) : "naro"; };
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
  if (String(unit).indexOf("침묵의 봄") >= 0) return springSystemPrompt_(unit);
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

/* 『침묵의 봄』 장별 핵심 내용 — question-festival-spring-data.js(학생 튜터 카드)와 같은 내용.
   AI 튜터가 이 자료를 근거로 답하게 해서 책 내용을 틀리지 않게 한다. */
const SPRING_NOTES = [
  "[1장 「내일을 위한 우화」 (A Fable for Tomorrow)] 미국 한가운데의 평화로운 마을. 꽃과 과수원, 철새와 송어로 가득하던 곳에 어느 날 이상한 병이 번져요. 닭·소·양이 앓다 죽고, 어른과 아이도 원인 모를 병에 걸려요. 봄이 왔는데 새소리가 들리지 않고, 사과나무는 꽃을 피워도 벌이 찾아오지 않아 열매를 맺지 못해요. 남은 단서는 몇 주 전 지붕과 잔디, 들판과 냇물 위에 눈처럼 내려앉았던 하얀 가루뿐이에요. 카슨은 이 마을이 실제로 있는 곳은 아니지만, 여기 나온 일들은 미국과 세계 곳곳에서 실제로 하나씩 일어난 일이라고 말해요. [원문] \"No witchcraft, no enemy action had silenced the rebirth of new life in this stricken world. The people had done it themselves.\" (번역: 마법도, 적의 공격도 아니었다. 이 상처 입은 세상에서 새 생명이 다시 태어나지 못하게 만든 것은 바로 사람들 자신이었다.) [과학 개념] 생태계의 연결 (생산자·소비자·분해자), 꽃가루받이",
  "[2장 「견뎌야 하는 의무」 (The Obligation to Endure)] 지구 생명의 역사는 생물과 환경이 서로 영향을 주고받은 역사였어요. 그런데 20세기에 들어 단 한 종, 인간이 세상을 크게 바꿀 힘을 갖게 되었어요. 1940년대 중반부터 해충·잡초·쥐 등을 죽이려고 200가지가 넘는 기본 화학 물질이 만들어졌고, 수천 가지 상품 이름으로 팔렸어요. 이 물질들은 목표한 벌레만 죽이지 않고 새, 물고기, 흙 속 생물, 사람에게까지 닿아요. 게다가 벌레는 곧 약에 견디는 무리로 바뀌어 더 독한 약이 필요해지는 악순환이 생겨요. 카슨은 약을 절대 쓰지 말자는 것이 아니라, 위험을 모르는 채 무차별로 쓰는 것이 문제라고 분명히 말해요. 장 제목은 프랑스 생물학자 장 로스탕의 말에서 왔어요. [원문] \"They should not be called 'insecticides,' but 'biocides.'\" (번역: 그것들은 \"살충제(벌레를 죽이는 약)\"가 아니라 \"살생물제(생명을 죽이는 약)\"라고 불러야 한다.) [원문] \"It is not my contention that chemical insecticides must never be used.\" (번역: 나는 화학 살충제를 절대 써서는 안 된다고 주장하는 것이 아니다.) [원문] \"The obligation to endure gives us the right to know.\" (번역: 견뎌야 하는 의무는 우리에게 알 권리를 준다. (장 로스탕)) [과학 개념] 자연 선택과 내성, 한 가지 작물만 넓게 심을 때(단일 경작) 해충이 늘어나는 까닭",
  "[3장 「죽음의 묘약」 (Elixirs of Death)] 카슨은 역사상 처음으로 모든 사람이 생명이 생기는 순간부터 죽을 때까지 위험한 화학 물질과 접촉하게 되었다고 경고해요. 살충제는 크게 두 무리예요. DDT·클로르데인·헵타클로르·디엘드린·알드린·엔드린 같은 유기염소계(염소화 탄화수소), 그리고 파라티온·말라티온 같은 유기인계. DDT는 1874년에 처음 합성되었지만, 벌레를 죽이는 효과는 1939년 스위스 화학자 파울 뮐러가 발견했어요. 전쟁 때는 군인과 피난민의 이를 잡으려고 사람 몸에 직접 가루를 뿌릴 만큼 안전하다고 여겨졌어요. 그러나 DDT는 기름(지방)에 녹아 몸속 지방에 쌓이고, 먹이를 따라 옮겨 다니며, 어머니의 젖에서도 발견돼요. 유기인계는 신경이 신호를 전하는 데 필요한 효소를 망가뜨려 급성 중독을 일으켜요. [원문] \"For the first time in the history of the world, every human being is now subjected to contact with dangerous chemicals, from the moment of conception until death.\" (번역: 세계 역사상 처음으로, 이제 모든 인간은 잉태되는 순간부터 죽을 때까지 위험한 화학 물질과 접촉하게 되었다.) [과학 개념] 물질의 성질 (물과 기름에 녹는 정도), 효소와 신경 전달",
  "[4장 「땅 위의 물과 땅속의 바다」 (Surface Waters and Underground Seas)] 농장·숲·정원에 뿌린 화학 물질은 빗물을 타고 강과 호수, 그리고 땅속 지하수로 흘러가요. 지하수는 서로 이어져 있어서 한 곳의 오염이 멀리 퍼질 수 있어요(콜로라도 덴버 근처 군 화학 공장의 폐수가 멀리 떨어진 농장의 작물까지 해친 사례). 가장 유명한 사례는 캘리포니아의 클리어 호예요. 낚시꾼을 괴롭히던 작은 각다귀를 없애려고 1949년부터 DDT와 비슷한 DDD를 물에 아주 묽게 — 약 5천만~7천만 분의 1 — 뿌렸어요. 물에서는 곧 거의 검출되지 않았지만, 플랑크톤 → 물고기 → 논병아리로 이어지는 먹이 사슬을 따라 농도가 엄청나게 높아졌어요. 1천 쌍이 넘던 서부논병아리는 1960년 무렵 30쌍 정도만 남았어요. [과학 개념] 먹이 사슬과 생물 농축, 농도(ppm), 지하수의 이동",
  "[5장 「흙의 왕국」 (Realms of the Soil)] 흙은 죽은 물질이 아니라 세균, 곰팡이, 조류, 진드기, 톡토기, 지렁이 같은 수많은 생물이 사는 왕국이에요. 이 생물들이 낙엽과 동물의 사체를 분해하고, 질소를 식물이 쓸 수 있는 형태로 바꿔 흙을 기름지게 해요(다윈도 지렁이가 흙을 만드는 일을 오래 연구했어요). 그런데 흙에 들어간 살충제 가운데 일부는 몇 년 동안 사라지지 않고 해마다 쌓여요. 작물이 뿌리로 이 물질을 빨아들이기도 하고, 어떤 약은 감자 같은 작물의 맛까지 바꿔 놓았어요. [과학 개념] 분해자, 물질의 순환 (질소 순환), 흙 속 생태계",
  "[6장 「지구의 푸른 외투」 (Earth's Green Mantle)] 식물은 지구를 덮은 푸른 외투이고, 동물과 사람의 삶이 모두 여기에 기대고 있어요. 그런데 사람들은 당장 쓸모없어 보이는 식물을 \"잡초\"라고 부르며 제초제로 없애려 했어요. 미국 서부에서는 소를 먹일 풀밭을 만들려고 넓은 세이지브러시(산쑥) 땅에 제초제를 뿌렸는데, 냇가의 버드나무까지 죽으면서 그 나무에 기대 살던 무스(말코손바닥사슴)와 비버의 터전이 무너졌어요. 길가 풀숲을 통째로 약으로 태우는 대신 필요한 곳만 골라 뿌리는 방법이 더 싸고 효과적이었다는 사례, 가축에 해로운 잡초를 그 풀만 먹는 딱정벌레를 들여와 줄인 생물학적 방제의 성공 사례도 나와요. [과학 개념] 생산자와 서식지, 생물 다양성, 생물학적 방제",
  "[7장 「쓸데없는 파괴」 (Needless Havoc)] 1950년대 미국 일리노이주 셸던 등에서는 일본에서 들어온 해충 왜콩풍뎅이를 없애려고 디엘드린 같은 독한 약을 넓게 뿌렸어요. 그 결과 울새·들종다리·꿩 같은 새와 다람쥐·토끼, 농장의 고양이까지 떼죽음을 당했어요. 그런데 미국 동부에서는 이미 이 풍뎅이 애벌레에게만 병을 일으키는 세균(유백병)을 이용해 효과를 보고 있었어요. 카슨은 더 안전한 방법이 있었는데도 \"빠르고 확실해 보이는\" 방법을 고른 결정을 비판해요. [원문] \"The question is whether any civilization can wage relentless war on life without destroying itself, and without losing the right to be called civilized.\" (번역: 문제는 어떤 문명이 생명을 상대로 끝없는 전쟁을 벌이면서도 스스로를 파괴하지 않고, 문명이라 불릴 자격을 잃지 않을 수 있느냐는 것이다.) [과학 개념] 목표 생물과 목표가 아닌 생물, 병원체를 이용한 방제",
  "[8장 「그리고 새는 노래하지 않는다」 (And No Birds Sing)] 느릅나무를 말려 죽이는 느릅나무 시들음병은 나무좀(작은 딱정벌레)이 병균을 옮겨요. 미국의 여러 도시와 대학은 이 벌레를 없애려고 느릅나무에 DDT를 듬뿍 뿌렸어요. 미시간 주립대학교 캠퍼스에서는 이듬해 봄, 울새들이 몸을 떨다 죽어 갔어요. 과학자들이 밝혀낸 경로는 이래요. DDT가 묻은 잎이 가을에 떨어짐 → 지렁이가 잎을 먹고 몸에 DDT를 쌓음 → 봄에 울새가 지렁이를 먹음. 큰 지렁이 11마리 정도면 울새에게 치명적인 양이 될 수 있었어요. 살아남은 새도 알을 덜 낳거나 알이 깨어나지 못했어요. 미국의 상징인 흰머리수리의 번식 실패도 이 장에 나와요. 카슨은 병든 나무를 빨리 베어 내는 위생 관리처럼 더 나은 방법이 있다고 말해요. [원문] \"Who has decided—who has the right to decide—for the countless legions of people who were not consulted that the supreme value is a world without insects…?\" (번역: 누가 결정했는가 — 누가 결정할 권리를 가졌는가 — 의견을 묻지도 않은 수많은 사람들을 대신해, 벌레 없는 세상이 가장 중요한 가치라고?) [과학 개념] 먹이 사슬과 축적, 번식과 개체군",
  "[9장 「죽음의 강」 (Rivers of Death)] 캐나다 뉴브런즈윅의 미라미치 강은 대서양 연어가 알을 낳으러 돌아오는 강이에요. 1954년, 가문비나무 숲을 갉아 먹는 나방 애벌레(가문비나무잎말이나방)를 없애려고 비행기로 숲에 DDT를 뿌렸어요. 며칠 지나지 않아 강가에 죽은 물고기가 보이기 시작했고, 그해 태어난 어린 연어가 거의 사라졌어요. 연어의 먹이인 강의 곤충(날도래·강도래 애벌레 등)까지 함께 죽어서, 살아남은 물고기도 먹을 것이 모자랐어요. 숲을 지키려던 결정이 강과 어부의 삶을 흔든 거예요. [과학 개념] 숲과 강 생태계의 연결, 먹이 그물, 물속 곤충",
  "[10장 「하늘에서 가리지 않고」 (Indiscriminately from the Skies)] 1950년대 미국 정부는 비행기로 넓은 지역에 약을 뿌리는 대규모 계획을 펼쳤어요. 1957년 뉴욕 롱아일랜드에서는 매미나방을 없앤다며 DDT를 기름에 섞어 주택가·농장·연못 위로 가리지 않고 뿌렸고, 조류학자 로버트 쿠시먼 머피 등 주민들이 소송을 냈어요(젖소가 뜯어 먹은 풀이 오염되어 우유에서도 DDT가 나왔어요). 같은 해 미국 남부에서는 불개미 박멸 계획으로 헵타클로르와 디엘드린을 아주 넓은 땅에 뿌렸지만, 불개미는 사라지지 않았고 새·가축·야생 동물이 큰 피해를 입었어요. 카슨은 불개미 피해는 부풀려졌고 약의 위험은 충분히 조사되지 않았다고 비판해요. [과학 개념] 개체군, 목표 생물과 목표가 아닌 생물",
  "[11장 「보르자 가문도 꿈꾸지 못한 것」 (Beyond the Dreams of the Borgias)] 보르자 가문은 독살로 악명 높았던 르네상스 시대 이탈리아의 권력 가문이에요. 제목은 그들도 상상하지 못했을 만큼 독성 물질이 일상 속에 들어왔다는 뜻이에요. 살충제는 농장뿐 아니라 잔디밭과 정원, 부엌 선반에 까는 종이, 옷장의 좀약, 반려동물 용품 등 집 안 곳곳에서 쓰였어요. 음식에 남은 농약에는 허용 기준이 정해져 있었지만, 카슨은 여러 음식에서 조금씩 먹는 양이 합쳐지는 문제와 검사가 충분하지 않은 현실을 지적해요. [과학 개념] 농도와 양, 여러 경로로 쌓이는 노출",
  "[12장 「인간이 치르는 대가」 (The Human Price)] 예전의 큰 건강 문제가 천연두·콜레라 같은 감염병이었다면, 이제는 사람이 만들어 낸 환경 속 화학 물질이 새로운 위험이 되었다고 카슨은 말해요. 문제는 그 영향이 당장 눈에 띄지 않고, 오랜 시간 조금씩 쌓인 뒤에야 나타난다는 점이에요. 몸의 독을 풀어 주는 간이 여러 화학 물질 때문에 손상되면 몸의 방어력이 떨어질 수 있고, 유기인계 살충제는 신경계에 영향을 주어 중독 사고를 일으켰어요. [원문] \"Like the constant dripping of water that in turn wears away the hardest stone, this birth-to-death contact with dangerous chemicals may in the end prove disastrous.\" (번역: 끊임없이 떨어지는 물방울이 결국 가장 단단한 돌도 닳게 하듯, 태어나서 죽을 때까지 이어지는 위험한 화학 물질과의 접촉은 끝내 재앙이 될 수 있다.) [과학 개념] 간의 해독 작용, 신경계, 오랜 기간의 노출",
  "[13장 「좁은 창을 통해」 (Through a Narrow Window)] 화학 물질의 영향은 몸 전체를 넘어 세포 속 아주 작은 세계에서도 일어나요. 세포는 미토콘드리아에서 양분을 분해해 에너지를 얻는데, 어떤 화학 물질은 이 에너지 생산 과정을 방해할 수 있어요. 또 어떤 물질은 염색체와 유전 물질을 손상시켜 돌연변이를 일으킬 수 있다고 카슨은 경고해요. 제목은 생물학자 조지 월드의 비유에서 왔어요. 좁은 창도 가까이 다가가면 점점 넓은 세상이 보이듯, 작은 세포를 들여다보면 생명 전체가 보인다는 뜻이에요. [과학 개념] 세포 호흡과 미토콘드리아, 염색체와 유전, 돌연변이",
  "[14장 「네 명 중 한 명」 (One in Every Four)] 제목은 당시 미국 암 학회가 \"지금 살아 있는 미국인 네 명 중 한 명이 언젠가 암에 걸릴 것\"이라고 추정한 데서 왔어요. 카슨은 1775년 영국 의사 퍼시벌 포트가 굴뚝 청소부에게 많은 암이 그을음과 관련 있다고 밝힌 일처럼, 환경 속 물질이 암을 일으킬 수 있다는 역사를 소개해요. 그리고 비소와 일부 살충제가 암과 관련될 수 있다고 경고하며, 치료만큼 노출을 줄이는 예방이 중요하다고 주장해요. ※ 오늘날 과학자들은 살충제와 암의 관계 가운데 일부는 카슨의 주장보다 약하거나 아직 논쟁 중이라고 보기도 해요. \"관련이 있다\"와 \"원인이다\"의 차이를 생각하며 읽어 보세요. [과학 개념] 발암 물질, 상관관계와 인과관계, 예방",
  "[15장 「자연의 반격」 (Nature Fights Back)] 자연에는 해충의 수를 조절하는 장치가 이미 있어요. 거미, 무당벌레, 기생벌 같은 천적이 해충을 잡아먹거나 그 몸에 알을 낳아 수를 억제해요. 그런데 살충제는 해충과 천적을 가리지 않고 죽여요. 천적이 사라지면 해충이 오히려 더 크게 불어나거나, 예전에는 문제가 아니던 곤충(예: 응애)이 새로운 해충이 되기도 해요. 카슨은 자연의 균형을 무시하는 것은 절벽 끝에 선 사람이 중력을 무시하는 것만큼 위험하다고 비유해요. [원문] \"…a complex, precise, and highly integrated system of relationships between living things which cannot safely be ignored any more than the law of gravity can be defied with impunity by a man perched on the edge of a cliff.\" (번역: (자연의 균형은) 생물들 사이의 복잡하고 정밀하며 긴밀하게 얽힌 관계의 체계이다. 절벽 끝에 선 사람이 중력의 법칙을 무시하고 무사할 수 없듯, 이것도 안전하게 무시할 수 없다.) [과학 개념] 먹이 그물과 개체 수 조절, 천적",
  "[16장 「눈사태의 울림」 (The Rumblings of an Avalanche)] 살충제를 뿌리면 대부분의 벌레는 죽지만, 우연히 약에 잘 견디는 성질을 가진 몇 마리가 살아남아요. 이들이 자손을 남기면 몇 세대 만에 약이 듣지 않는 저항성(내성) 무리가 돼요. DDT를 쓰기 시작한 지 몇 년 만에 이탈리아 등지의 집파리가 DDT에 견디게 되었고, 모기와 이에서도 같은 일이 일어났어요. 책에는 한국 전쟁 무렵 한국에서 DDT가 이를 잡지 못한 사례도 나와요. 카슨은 저항성을 가진 곤충이 해마다 늘어나는 것을 멀리서 들려오는 눈사태의 울림에 비유했어요. [과학 개념] 변이와 자연 선택, 진화, 항생제 내성",
  "[17장 「다른 길」 (The Other Road)] 마지막 장에서 카슨은 화학 약품이 아닌 다른 길을 보여 줘요. 소의 상처에 알을 낳는 나선구더기파리는 방사선으로 번식 능력을 없앤 수컷을 대량으로 풀어 놓는 방법(곤충학자 에드워드 니플링)으로 카리브 해의 퀴라소 섬(1954년)과 미국 플로리다에서 거의 사라졌어요. 특정 곤충에게만 병을 일으키는 세균(바실루스 투린지엔시스 등), 천적 곤충을 들여오는 방법, 곤충을 끌어들이는 냄새(유인 물질)나 소리를 이용하는 방법도 소개해요. 모두 자연을 억지로 누르기보다 생물의 특성을 이해하고 이용하는 길이에요. [원문] \"We stand now where two roads diverge.\" (번역: 우리는 지금 두 갈래 길이 갈라지는 곳에 서 있다. (로버트 프로스트의 시 「가지 않은 길」을 떠올리게 하는 문장)) [원문] \"The 'control of nature' is a phrase conceived in arrogance, born of the Neanderthal age of biology and philosophy, when it was supposed that nature exists for the convenience of man.\" (번역: \"자연의 통제\"라는 말은 자연이 인간의 편리를 위해 존재한다고 여기던 생물학과 철학의 네안데르탈 시대에, 오만함에서 태어난 말이다. (책의 마지막 문단)) [과학 개념] 생식, 생물학적 방제, 여러 방법을 함께 쓰는 해충 관리(종합적 해충 관리)"
];
const SPRING_BOOK_FACTS = [
  "저자 레이첼 카슨(1907~1964): 미국 펜실베이니아주 스프링데일 출생, 해양생물학자이자 작가. 1936년부터 미국 어업국(뒤에 어류·야생동물국)에서 일함. 『우리를 둘러싼 바다』(1951) 베스트셀러.",
  "『침묵의 봄』: 1962년 6월 잡지 『뉴요커』 연재, 9월 출간. 화학 회사들의 거센 반발. 1963년 대통령 과학자문위원회 보고서가 경고를 상당 부분 뒷받침, 카슨은 의회 증언. 1964년 4월 암으로 별세.",
  "이후: 1970년 미국 환경보호청(EPA) 설립과 첫 지구의 날, 1972년 미국 DDT 농업용 사용 금지, 2001년 스톡홀름 협약 채택(말라리아 방역용 DDT는 예외), 2007년 흰머리수리가 미국 멸종위기종 목록에서 빠짐.",
  "책 맨 앞 인용: 존 키츠의 시 \"The sedge is wither'd from the lake, And no birds sing.\" / 슈바이처에게 바침: \"Man has lost the capacity to foresee and to forestall. He will end by destroying the earth.\"",
  "4장 클리어 호 숫자: 물에 뿌린 DDD 약 5천만 분의 1(약 0.02 ppm), 플랑크톤 약 5 ppm, 초식성 물고기 40~300 ppm, 육식성 물고기(메기 종류) 2,500 ppm, 논병아리 지방 1,600 ppm. 1천 쌍이 넘던 서부논병아리가 1960년 무렵 약 30쌍."
];
const springReference_ = function () {
  return ["[참고 자료 — 책의 기본 정보]"].concat(SPRING_BOOK_FACTS, ["[참고 자료 — 장별 핵심 내용]"], SPRING_NOTES).join("\n");
};

/* 『침묵의 봄』(레이첼 카슨) 독서 튜터: 책 내용을 근거로 생각할 거리를 던진다 */
function springSystemPrompt_(unit) {
  return [
    "너는 레이첼 카슨의 『침묵의 봄』(Silent Spring, 1962)을 깊이 알고 있는 '독서 튜터'이자 'AI 조사 도우미'이다.",
    "대상: 아화중학교 3학년. 연습 주제: " + unit + ". 학생들은 질문·탐구 궁금한마당(탐색 → 생성 → 선정 → 탐구 → 발표)을 연습한다.",
    "규칙:",
    "1. 한국어로, 중학교 3학년 눈높이에 맞춰 친절하게 답한다.",
    "2. 맨 아래 [참고 자료]를 가장 먼저 근거로 삼는다. 책 속 장소·연도·숫자·과정은 참고 자료와 똑같이 쓰고(예: 미시간 주립대학교, 떨어진 잎 → 지렁이 → 울새), 어느 장의 이야기인지 밝힌다. 참고 자료와 내 기억이 다르면 참고 자료를 따른다.",
    "3. 원문을 인용할 때는 참고 자료에 [원문]으로 적힌 문장만 쓰고, 영어 원문과 번역을 함께 쓴다. 그 밖의 문장은 인용하지 말고 요약한다. 책에 없는 문장을 지어내지 않는다.",
    "4. 참고 자료에 없는 연도·수치·이름은 확실한 것만 쓰고, 불확실하면 '책에서 확인해 보세요'라고 안내한다. 학생이 '책에서 찾아보기' 과제(예: 저항성 곤충 종 수, 한국 전쟁 때의 사례, 우리나라의 DDT 금지 연도)를 물으면 답을 바로 주지 말고 찾는 방법을 안내한다.",
    "5. 학생이 책 내용을 물으면 핵심을 설명한 뒤, 학생이 스스로 생각하도록 '튜터의 질문'을 1~2개 던진다. 정답이나 결론을 대신 정해 주지 않는다.",
    "6. 오늘날과 연결할 때(예: 농약과 꿀벌, 미세플라스틱, 잔류성 유기오염물질, 우리 동네 방역)는 여러 관점을 함께 소개하고, 논쟁이 있는 내용은 그렇다고 밝힌다. 카슨이 '모든 화학 살충제를 쓰지 말자'고 한 것이 아니라 위험을 모른 채 무차별로 쓰는 것을 비판했다는 점을 정확히 전한다.",
    "7. 관련 과학 개념(먹이 사슬과 생물 농축, 지용성 물질의 축적, 해충의 내성과 자연 선택, 천적과 생물학적 방제, 세포와 유전)을 중학생 수준으로 연결한다.",
    "8. 3~5개 항목(- 로 시작), 전체 700~1,000자로 문장이 끊기지 않게 마무리하고, 마지막 줄에 '튜터의 질문:'으로 시작하는 질문을 하나 쓴다.",
    "9. 개인 정보나 부적절한 내용은 정중히 거절한다. 학생이 제출할 글이나 발표문을 통째로 써 달라고 하면 거절하고 정리 방법을 안내한다.",
    "",
    springReference_()
  ].join("\n");
}

function inquiryFeedbackPrompt_(unit) {
  return [
    "너는 '" + unit + "' 질문탐구 연습을 돕는 'AI 조사 도우미'이다.",
    "학생이 정리한 탐구 질문, 잠정적인 답, 이어진 질문을 읽고 짧게 피드백한다.",
    "형식: '잘한 점' 1개, '질문 점검'(참신성·삶과의 연결·90분 안 탐구 가능성 중 가장 필요한 것 한 가지), '근거 확인'(근거가 부족하거나 사실과 다른 부분, 없으면 '특별한 문제 없음'), '보완하면 좋을 점' 1~2개.",
    "한국어로, 중학생에게 다정하게, 전체 450자 이내로 쓴다. 학생의 글을 대신 다시 써 주지 않는다."
  ].concat(String(unit).indexOf("침묵의 봄") >= 0 ? ["책 내용이 맞는지는 아래 [참고 자료]로 확인한다.", "", springReference_()] : []).join("\n");
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
    saves: Object.keys(BOOKS).reduce(function (all, k) {   // 자동 저장된 학생 글 전체(상태) + 책 이름
      return all.concat(readRows_(BOOKS[k].save).map(function (o) { o["도서"] = BOOKS[k].title; return o; }));
    }, [])
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
function saveRowOf_(me, book) {
  const sh = sheetWithHead_(BOOKS[book || "naro"].save, SAVE_HEAD), n = sh.getLastRow() - 1;
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
  const s = saveRowOf_(me, bookOf_(data));
  let saved = null;
  if (s.values) {
    const at = s.values[3];
    saved = { at: at instanceof Date ? at.toISOString() : String(at), kind: String(s.values[4]), state: String(s.values[11] || "") };
  }
  return json_({ result: "success", book: bookOf_(data), student: { cls: me.cls, num: me.num, name: me.name }, saved: saved });
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
    const s = saveRowOf_(me, bookOf_(data));
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
