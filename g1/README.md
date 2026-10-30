# 중학교 1학년 워크시트 (KISPP 과학실에서 가져옴)

프놈펜한국국제학교 KISPP 과학실(zube-kr/kispp)의 `materials/g1-1` ~ `g1-7` 워크시트 60개를
이 사이트에서 그대로 쓸 수 있게 옮겨 온 폴더입니다.

| 경로 | 내용 |
|---|---|
| `materials/g1-1` ~ `g1-7` | 단원별 워크시트(살아있는 교과서·아두이노 실험)와 그림·아두이노 코드 |
| `js/ws-kit.js`, `js/ws-kit.css` | 워크시트 공통 채점·피드백·제출 |
| `js/part-view.js` | `?part=concept` 처럼 열면 그 구간만 보여 주기 |
| `js/config.js` | 답안 제출 주소 — 이 사이트의 다른 워크시트와 같은 스프레드시트 웹 앱(루트 `code.gs`)으로 바꿔 둠 |
| `js/vendor/three.min.js` | 3D 시뮬레이션용 three.js |

가져오면서 바꾼 것
- 답안 제출 주소: KISPP 중1 시트 → 이 사이트 워크시트 시트(워크시트 제목 이름의 탭에 저장)
- 맨 위 "← KISPP 과학실" 링크 → 이 사이트 첫 화면(`../../../index.html`)
- 맨 아래 학교 표기, 아두이노 코드 머리말의 "KISPP" → 아화중학교

목록은 루트 `index.html`의 `topicsData`에 단원별로 등록되어 있습니다
(`gwahak-illyu`, `saengmul-guseong`, `yeol`, `mul-sangtae-byeonhwa`, `him-jagyong`, `gi-seongjil`, `taeyanggye`).
