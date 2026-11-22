/* =====================================================================
   과학 학습 목표 데이터베이스
   - 영역(7개)은 모든 단원에 공통, 세부 목표는 단원마다 다르게.
   - 목표 코드는 절대 바꾸지 마세요(기록이 이 코드로 연결됩니다).
     워크시트가 여러 개여도 같은 목표면 같은 코드에 연결하면 됩니다.
   - 새 단원 추가: UNITS 에 같은 모양으로 한 덩어리 추가.
   ===================================================================== */
(function (g) {
  const AREAS = [
    { key: "concept",  name: "개념 이해",    q: "과학 개념과 원리를 이해하는가?" },
    { key: "explain",  name: "과학적 설명",  q: "현상을 과학적 근거로 설명하는가?" },
    { key: "data",     name: "자료 해석",    q: "표, 그래프, 실험 데이터를 해석하는가?" },
    { key: "design",   name: "탐구 설계",    q: "변인을 설정하고 실험을 설계하는가?" },
    { key: "math",     name: "수리적 적용",  q: "수식과 수학적 관계를 적용하는가?" },
    { key: "model",    name: "모델링",       q: "현상을 모형으로 표현하고 예측하는가?" },
    { key: "transfer", name: "전이 및 적용", q: "새로운 상황에도 배운 원리를 적용하는가?" },
  ];
  const LEVELS = [
    { lv: 0, name: "기록 없음", short: "-",  desc: "아직 이 목표에 대한 증거가 없어요" },
    { lv: 1, name: "미도달",    short: "L1", desc: "개념을 이해하지 못하거나 오개념이 있음" },
    { lv: 2, name: "발달 중",   short: "L2", desc: "힌트나 도움을 받아 해결할 수 있음" },
    { lv: 3, name: "숙달",      short: "L3", desc: "도움 없이 개념을 이해하고 적용함" },
    { lv: 4, name: "심화·전이", short: "L4", desc: "새로운 상황에 적용하고 근거를 들어 설명함" },
  ];
  /* 학습 순환: 학습 목표 → 학습 활동 → 메타질문 → 루브릭 평가 → 피드백·재학습 */
  const CYCLE = [
    { key: "goal",     name: "학습 목표",   q: "무엇을 배울 것인가?" },
    { key: "activity", name: "학습 활동",   q: "지식·이해 / 과정·기능 / 가치·태도" },
    { key: "meta",     name: "메타질문",    q: "나는 무엇을 이해했고, 어떻게 생각했는가?" },
    { key: "rubric",   name: "루브릭 평가", q: "학습 목표에 어느 정도 도달했는가?" },
    { key: "feedback", name: "피드백·재학습", q: "무엇을 보완하고 어떻게 성장할 것인가?" },
  ];
  /* 메타질문 4단계 (메타인지 · 자기조절학습 · 성찰적 사고) */
  const META_STAGES = [
    { key: "before", name: "학습 전 · 생각하기", type: "사전 인식", hint: "내가 이미 알고 있는 것은 무엇인가?" },
    { key: "during", name: "학습 중 · 점검하기", type: "사고 과정 · 이해 점검", hint: "나는 왜 이렇게 판단했는가? 근거는 충분한가?" },
    { key: "after",  name: "학습 후 · 돌아보기", type: "전략 수정", hint: "처음 생각과 지금 생각은 어떻게 달라졌는가?" },
    { key: "extend", name: "나의 다음 질문", type: "가치·태도 · 발산적 사고", hint: "배운 것을 넘어, 나는 무엇을 더 알고 싶고 어떤 학습자가 되고 싶은가?" },
  ];
  const RATE = [{ v: 1, name: "거의 몰라요" }, { v: 2, name: "조금 알아요" }, { v: 3, name: "대부분 알아요" }, { v: 4, name: "설명할 수 있어요" }];
  /* 루브릭: 2022 개정 교육과정 교과 역량 · 학습 요소 */
  const DOMAINS = [
    { key: "knowledge", name: "지식·이해" }, { key: "process", name: "과정·기능" }, { key: "attitude", name: "가치·태도" },
  ];
  const RUBRIC_LEVELS = [{ lv: 4, name: "매우 우수" }, { lv: 3, name: "우수" }, { lv: 2, name: "보통" }, { lv: 1, name: "노력 필요" }];
  const CONFIDENCE = [
    { v: 4, name: "매우 확신함" }, { v: 3, name: "어느 정도 확신함" },
    { v: 2, name: "잘 모르겠음" }, { v: 1, name: "추측해서 답함" },
  ];

  const UNITS = {
    "ASTRO-PARALLAX": {
      grade: 3, title: "별까지의 거리 · 별의 시차", chapter: "별과 우주",
      activities: { "parallax-ws": { title: "별의 시차 워크시트", url: "parallax.html",
        /* 문항 → 학습 목표 연결 (kind: core 기본 · transfer 전이 · text 서술형=교사 판정) */
        items: {
          "exp-data":   { label: "실험 결과 정리(팔 폈을 때·굽혔을 때)", kind: "core",     objectives: ["ASTRO-PARALLAX-07"] },
          "concept1":   { label: "개념정리 1 · 시차와 거리",            kind: "core",     objectives: ["ASTRO-PARALLAX-01", "ASTRO-PARALLAX-04"] },
          "concept2":   { label: "개념정리 2 · 연주 시차",              kind: "core",     objectives: ["ASTRO-PARALLAX-02", "ASTRO-PARALLAX-04"] },
          "xy":         { label: "별 X·Y 연주 시차 비교(그림)",          kind: "core",     objectives: ["ASTRO-PARALLAX-03", "ASTRO-PARALLAX-04"] },
          "q1":         { label: "문제 1 · 연주 시차 설명 고르기",       kind: "core",     objectives: ["ASTRO-PARALLAX-02", "ASTRO-PARALLAX-03"] },
          "q2":         { label: "문제 2 · 별 A까지의 거리 계산",        kind: "core",     objectives: ["ASTRO-PARALLAX-05"] },
          "probe-move": { label: "확인 1 · 별의 겉보기 위치가 바뀌는 까닭", kind: "core",  objectives: ["ASTRO-PARALLAX-02"] },
          "draw-angle": { label: "확인 2 · 연주 시차를 그림으로",        kind: "core",     objectives: ["ASTRO-PARALLAX-03"] },
          "limit":      { label: "확인 3 · 시차 측정의 한계",            kind: "core",     objectives: ["ASTRO-PARALLAX-06"] },
          "t-calc":     { label: "도전 1 · 처음 보는 별의 거리",         kind: "transfer", objectives: ["ASTRO-PARALLAX-05"] },
          "t-stereo":   { label: "도전 2 · 자동차 스테레오 카메라",      kind: "transfer", objectives: ["ASTRO-PARALLAX-04", "ASTRO-PARALLAX-01"] },
          "reflection": { label: "서술 · 팔을 굽혔을 때 시차가 큰 까닭",  kind: "text",     objectives: ["ASTRO-PARALLAX-07", "ASTRO-PARALLAX-04"] },
          "ex2Reason":  { label: "서술 · 빨대 실험 (가)·(나) 비교",      kind: "text",     objectives: ["ASTRO-PARALLAX-07"] },
          "ex2AltMethod": { label: "서술 · 시차를 재는 다른 방법",       kind: "text",     objectives: ["ASTRO-PARALLAX-08"] },
          /* 학습 전 사전 진단 (숙달 판정에는 쓰지 않고, 처음 생각·오개념 확인용) */
          "diag-near":   { label: "사전 진단 1 · 가까운 것과 먼 것",     kind: "diag",     objectives: ["ASTRO-PARALLAX-01", "ASTRO-PARALLAX-04"] },
          "diag-method": { label: "사전 진단 2 · 별까지 거리 재는 법",   kind: "diag",     objectives: ["ASTRO-PARALLAX-02"] },
          /* 과학적 논증 (CER: 주장-근거-추론) */
          "cer-claim":     { label: "논증 · 주장",  kind: "core", objectives: ["ASTRO-PARALLAX-04"] },
          "cer-evidence":  { label: "논증 · 근거",  kind: "text", objectives: ["ASTRO-PARALLAX-07"] },
          "cer-reasoning": { label: "논증 · 추론",  kind: "text", objectives: ["ASTRO-PARALLAX-04"] },
          /* 재학습 변형 문항 (제출 뒤 약한 목표만 다시 도전) */
          "re-01": { label: "재도전 · 시차의 뜻",               kind: "core", objectives: ["ASTRO-PARALLAX-01"] },
          "re-02": { label: "재도전 · 6개월 간격으로 관측하는 까닭", kind: "core", objectives: ["ASTRO-PARALLAX-02"] },
          "re-03": { label: "재도전 · 연주 시차를 나타내는 각",   kind: "core", objectives: ["ASTRO-PARALLAX-03"] },
          "re-04": { label: "재도전 · 더 가까운 별 고르기",       kind: "core", objectives: ["ASTRO-PARALLAX-04"] },
          "re-05": { label: "재도전 · 연주 시차로 거리 계산",     kind: "core", objectives: ["ASTRO-PARALLAX-05"] },
          "re-06": { label: "재도전 · 아주 먼 별의 시차",         kind: "core", objectives: ["ASTRO-PARALLAX-06"] },
          "re-07": { label: "재도전 · 거리-시차 자료 해석",       kind: "core", objectives: ["ASTRO-PARALLAX-07"] },
        } } },
      objectives: [
        { code: "ASTRO-PARALLAX-01", area: "concept",  text: "시차의 개념을 설명한다",
          basic: "시뮬레이션에서 팔 길이를 바꿔 가며 두 눈으로 번갈아 본 위치 차이를 다시 관찰하기",
          deep: "자동차 스테레오 카메라·사람의 두 눈이 거리를 아는 방법과 시차를 비교해 설명하기" },
        { code: "ASTRO-PARALLAX-02", area: "explain",  text: "관측 위치에 따른 별의 겉보기 위치 변화를 설명한다",
          basic: "지구 공전 그림에서 1월·7월 위치에서 같은 별을 볼 때 배경별에 대한 방향을 직접 그려 보기",
          deep: "별의 실제 운동(고유 운동)과 시차를 구별하는 관측 방법을 조사하기" },
        { code: "ASTRO-PARALLAX-03", area: "model",    text: "시차각을 그림으로 표현한다",
          basic: "지구-태양-별 그림에 1 AU와 연주 시차(p)를 표시하는 연습 그림 그리기",
          deep: "연주 시차 그림으로 '1 pc'의 정의를 스스로 유도해 설명하기" },
        { code: "ASTRO-PARALLAX-04", area: "explain",  text: "시차와 거리의 반비례 관계를 설명한다",
          basic: "가까운 물체·먼 물체를 두 눈으로 번갈아 보며 어느 쪽이 더 많이 움직이는지 비교하기",
          deep: "거리가 2배·10배가 되면 시차가 어떻게 되는지 표와 그래프로 나타내기" },
        { code: "ASTRO-PARALLAX-05", area: "math",     text: "시차각으로 별까지의 거리를 계산한다",
          basic: "거리(pc) = 1 ÷ 연주 시차(″) 를 0.5″, 1″, 2″ 세 별로 단계별 계산 연습",
          deep: "실제 별(프록시마 센타우리 0.77″, 시리우스 0.38″)의 거리를 pc와 광년으로 계산하기" },
        { code: "ASTRO-PARALLAX-06", area: "transfer", text: "시차 관측의 한계를 설명한다",
          basic: "시차가 0.01″보다 작으면 어떤 일이 생기는지 계산(100 pc 이상)으로 확인하기",
          deep: "지상 망원경과 우주 망원경(가이아)의 측정 한계를 비교하고, 더 먼 별의 거리를 재는 다른 방법 조사하기" },
        { code: "ASTRO-PARALLAX-07", area: "data",     text: "실험 결과로 거리와 시차의 관계를 해석한다",
          basic: "팔을 폈을 때·굽혔을 때 읽은 번호 차이를 표에 다시 정리하고 어느 쪽이 큰지 비교하기",
          deep: "물체까지 거리를 3가지 이상으로 바꿔 측정하고 거리-시차 그래프 그리기" },
        { code: "ASTRO-PARALLAX-08", area: "design",   text: "시차를 측정하는 실험 방법을 설계한다",
          basic: "빨대 실험의 변인(관측 지점 사이 거리, 물체까지 거리)을 표로 정리하기",
          deep: "한쪽 눈만으로 두 지점에서 관측하는 실험을 직접 설계하고 실행하기" },
      ],
      /* 메타질문: type = rate(자기평가) · text(서술) · ideas(여러 생각 늘어놓기) · revisit(처음 내 질문 다시 보기) */
      meta: {
        before: [
          { id: "mb-question", type: "ideas", q: "위 장면을 보고 떠오른 궁금증을 질문으로 만들어 보세요. '왜 ~할까?', '어떻게 ~할까?', '만약 ~라면?' (2개 이상)" },
          { id: "mb-main",     type: "text",  q: "그중 오늘 꼭 알아내고 싶은 질문 하나를 골라 적어 보세요. 이것이 오늘 나의 탐구 질문이에요." },
          { id: "mb-rate",     type: "rate",  q: "나는 '별까지의 거리를 재는 방법'을 지금 얼마나 알고 있나?" },
          { id: "mb-prior",    type: "text",  q: "내 탐구 질문에 대한 지금 내 생각(예상 답)은? 틀려도 괜찮아요." },
        ],
        during: [
          { id: "md-why",      type: "text", q: "실험에서 팔을 굽혔을 때와 폈을 때 결과가 달랐다. 나는 그 까닭을 어떤 근거로 판단했나? 그 근거는 충분한가?" },
          { id: "md-strategy", type: "text", q: "빨대 실험 결과가 내 예상과 달랐다면(또는 같았다면), 무엇을 다시 확인하거나 바꿔야 할까?" },
        ],
        after: [
          { id: "ma-rate",   type: "rate", q: "학습을 마친 지금, 나는 이 내용을 얼마나 알고 있나?" },
          { id: "ma-change", type: "text", q: "처음 생각과 지금 생각은 어떻게 달라졌나? 처음에 잘못 알고 있던 부분이 있다면 무엇인가?" },
          { id: "ma-check",  type: "text", q: "내가 정말 이해했는지 어떻게 알 수 있을까? 친구에게 설명하듯 시차와 거리의 관계를 한두 문장으로 써 보세요." },
        ],
        extend: [
          { id: "me-revisit", type: "revisit", q: "처음에 만든 내 질문을 다시 보자. 해결된 질문과 아직 남은 질문은?" },
          { id: "me-next",    type: "ideas",   q: "더 알고 싶어진 것은? 다음에 탐구하고 싶은 질문을 떠오르는 대로 늘어놓아 보세요. (많을수록 좋아요)" },
          { id: "me-apply",   type: "ideas",   q: "시차의 원리는 별 말고 어디에 쓰일 수 있을까? 우리 몸, 기계, 생활, 직업… 자유롭게!" },
          { id: "me-value",   type: "text",    q: "인류가 맨눈으로는 잴 수 없는 별까지의 거리를 알아낸 것은 우리에게 어떤 의미가 있을까?" },
          { id: "me-self",    type: "text",    q: "오늘 나는 어떤 학습자였나? 잘한 점, 그리고 다음 시간에 바꾸고 싶은 나의 공부 방법은?" },
        ],
      },
      /* 이 주제의 평가 요소: 모든 요소를 다 넣지 않고 주제에 맞게 골라 씀 */
      rubricFocus: "정량적 관측·계산 주제라 '개념 설명'과 '자료 해석·계산', 빨대 실험의 '탐구 설계'를 보고, 스스로 질문을 세우고 이어 가는 '가치·태도'를 함께 봅니다. (모델링·전이는 개념 설명에 포함)",
      rubric: [
        { key: "K1", domain: "knowledge", name: "개념 이해·설명", objectives: ["ASTRO-PARALLAX-01", "ASTRO-PARALLAX-02", "ASTRO-PARALLAX-04", "ASTRO-PARALLAX-06"],
          desc: { 4: "시차가 생기는 까닭(관측 위치 변화)과 거리와의 반비례 관계, 시차 관측의 한계까지 근거를 들어 설명함", 3: "시차의 뜻과 거리와의 반비례 관계를 정확히 설명함", 2: "시차의 뜻은 알지만 거리와의 관계 설명이 부정확함", 1: "시차를 별의 실제 운동과 혼동하거나 관계를 반대로 이해함" } },
        { key: "P1", domain: "process", name: "자료 해석·수리적 적용", objectives: ["ASTRO-PARALLAX-05", "ASTRO-PARALLAX-07"],
          desc: { 4: "실험 자료에서 규칙을 찾고, 연주 시차로 별까지의 거리를 정확히 계산·해석함", 3: "실험 결과를 해석하고 거리 = 1 ÷ 연주 시차로 계산함", 2: "안내에 따라 자료를 읽고 계산함", 1: "자료 해석이나 거리 계산에 어려움이 있음" } },
        { key: "P2", domain: "process", name: "탐구 설계·모형 표현", objectives: ["ASTRO-PARALLAX-03", "ASTRO-PARALLAX-08"],
          desc: { 4: "연주 시차를 그림으로 정확히 나타내고, 시차를 재는 새로운 실험을 스스로 설계함", 3: "연주 시차를 그림으로 나타내고 실험 방법을 제안함", 2: "안내에 따라 그림과 실험을 수행함", 1: "그림 표현과 실험 설계에 도움이 필요함" } },
        { key: "A1", domain: "attitude", name: "질문하고 탐구를 이어 가는 태도", objectives: [], meta: true,
          desc: { 4: "스스로 탐구 질문을 세우고, 배운 뒤 해결된 질문과 남은 질문을 구분하며, 새로운 탐구 질문과 적용을 다양하게 제안하고 자신의 학습을 돌아봄", 3: "탐구 질문을 세우고, 생각의 변화와 더 알고 싶은 것을 적음", 2: "질문 만들기나 성찰을 일부만 함", 1: "질문 만들기와 성찰 참여가 부족함" } },
      ],
      misconceptions: {
        "M-PLX-REVERSE":   { obj: "ASTRO-PARALLAX-04", text: "시차각과 거리의 관계를 반대로 이해 (시차가 클수록 멀다고 생각)",
                             fix: "가까운 손가락과 먼 건물을 번갈아 볼 때 무엇이 더 많이 움직이는지 다시 관찰해 보세요." },
        "M-PLX-STARMOVE":  { obj: "ASTRO-PARALLAX-02", text: "시차를 별의 실제 운동으로 혼동",
                             fix: "별이 움직인 것이 아니라, 지구가 공전해서 '보는 위치'가 바뀐 것이에요." },
        "M-PLX-VIEWPOINT": { obj: "ASTRO-PARALLAX-02", text: "관측 위치 변화(지구 공전)의 의미를 이해하지 못함",
                             fix: "6개월 뒤 지구는 태양 반대편에 있어요. 두 관측 지점 사이 거리가 가장 멀어질 때예요." },
        "M-PLX-INTERVAL":  { obj: "ASTRO-PARALLAX-02", text: "연주 시차 측정 간격을 1년으로 착각",
                             fix: "1년 뒤에는 지구가 같은 자리로 돌아와요. 반대편에 있는 6개월 간격으로 관측해야 해요." },
        "M-PLX-HALF":      { obj: "ASTRO-PARALLAX-03", text: "연주 시차를 6개월 시차 전체로 착각 (1/2 누락)",
                             fix: "연주 시차는 6개월 간격 관측에서 생긴 각의 절반, 즉 지구-태양 거리(1 AU)가 만드는 각이에요." },
        "M-PLX-FORMULA":   { obj: "ASTRO-PARALLAX-05", text: "거리(pc) = 1 ÷ 연주 시차 공식을 잘못 적용",
                             fix: "연주 시차가 커질수록 거리는 작아져요. 거리 = 1 ÷ 시차, 시차 값을 그대로 거리로 쓰면 안 돼요." },
      },
    },
  };

  /* 찾기 도우미 */
  const OBJ = {}, MISC = {}, ITEM = {};
  for (const [u, U] of Object.entries(UNITS)){
    U.code = u;
    U.objectives.forEach((o, i) => { o.unit = u; o.no = i + 1; OBJ[o.code] = o; });
    for (const [k, m] of Object.entries(U.misconceptions || {})){ m.code = k; m.unit = u; MISC[k] = m; }
    for (const [a, A] of Object.entries(U.activities || {})) for (const [k, it] of Object.entries(A.items || {})){ it.id = k; it.activity = a; ITEM[a + ":" + k] = it; }
  }
  const area = k => AREAS.find(a => a.key === k);
  g.LMS_DB = { AREAS, LEVELS, CONFIDENCE, CYCLE, META_STAGES, RATE, DOMAINS, RUBRIC_LEVELS, UNITS, OBJ, MISC, ITEM, area, item: (act, id) => ITEM[act + ":" + id] };
})(window);
