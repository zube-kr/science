# 중학교 2학년 워크시트 (KISPP 과학실에서 가져옴)

프놈펜한국국제학교 KISPP 과학실(zube-kr/kispp)의 중2 `materials/g2-7`(Ⅶ. 전기와 자기),
`materials/g2-8`(Ⅷ. 별과 우주) 워크시트 15개를 이 사이트에서 그대로 쓸 수 있게 옮겨 온 폴더입니다.

| 경로 | 내용 |
|---|---|
| `materials/g2-7` | 전기와 자기 살아있는 교과서 8개 + 아두이노 옴의 법칙 실험 보고서, 그림·아두이노 코드 |
| `materials/g2-8` | 별과 우주 라이브 워크시트 6개(시차, 밝기, 색, 우리은하, 성단과 성운, 팽창하는 우주) |
| `js/ws-kit.js`, `js/ws-kit.css` | 워크시트 공통 채점·피드백·제출 |
| `js/part-view.js` | `?part=concept` 처럼 열면 그 구간만 보여 주기 |
| `js/config.js` | 답안 제출 주소 — 이 사이트의 다른 워크시트와 같은 스프레드시트 웹 앱(루트 `code.gs`) |

가져오면서 바꾼 것
- 답안 제출 주소: KISPP 중2 시트 → 이 사이트 워크시트 시트(워크시트 제목 이름의 탭에 저장)
- 별과 우주 워크시트는 JSON으로 보내던 답안을 `config.js`의 `toForm()`으로 폼 형식으로 바꿔 보냄
  (탭 이름 "중2 Ⅷ 시차 측정하기" 등, 점수는 score·total 칸)
- 전기와 자기 워크시트의 공통 디자인(`livebook.css`, `livebook.js`)은 `g1/materials/g1-3/`의 것을 같이 씀
- 맨 위 "← KISPP 과학실" 링크 → 이 사이트 첫 화면(`../../../index.html`)
- 학교 표기, 아두이노 코드 머리말의 "KISPP" → 아화중학교

목록은 루트 `index.html`의 `topicsData`에 `jeongi-jagi`(⑦ 전기와 자기), `byeol-uju`(⑧ 별과 우주)로 등록되어 있습니다.
