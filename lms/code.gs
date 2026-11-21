/* =====================================================================
   과학 학습 성장 관리 — Google Apps Script (서버)
   설치 방법
   1) 새 구글 스프레드시트 → 확장 프로그램 → Apps Script → 이 코드를 통째로 붙여넣기
   2) 아래 TEACHER_KEY 를 선생님만 아는 비밀번호로 바꾸기
   3) 위쪽 함수 목록에서 setup 선택 → 실행(권한 허용) → '학생', '학습기록' 시트가 생김
   4) '학생' 시트에 학년·반·번호·이름을 적고, makeCodes 실행 → 개인코드 자동 생성
   5) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 / 액세스: 모든 사용자 → 배포
   6) 나온 웹 앱 주소(…/exec)를 lms/config.js 의 apiUrl 에 넣기
   ※ 학생 이름은 이 시트에만 있고, 학습 기록에는 학년-반-번호만 저장됩니다.
   ===================================================================== */
const TEACHER_KEY = '여기에-선생님-비밀번호';   // ← 꼭 바꾸세요

const SH_ROSTER = '학생';
const SH_LOG = '학습기록';
const LOG_COLS = ['ts', 'sid', 'unit', 'activity', 'session', 'item', 'objectives', 'kind', 'correct', 'attempts', 'level', 'confidence', 'misconceptions', 'answer', 'aided', 'savedAt'];
const ROSTER_COLS = ['학년', '반', '번호', '이름', '개인코드'];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let r = ss.getSheetByName(SH_ROSTER);
  if (!r) { r = ss.insertSheet(SH_ROSTER); r.appendRow(ROSTER_COLS); r.setFrozenRows(1); r.getRange('A1:E1').setFontWeight('bold').setBackground('#e8eefc'); }
  let l = ss.getSheetByName(SH_LOG);
  if (!l) { l = ss.insertSheet(SH_LOG); l.appendRow(LOG_COLS); l.setFrozenRows(1); l.getRange(1, 1, 1, LOG_COLS.length).setFontWeight('bold').setBackground('#e8f7ee'); }
  r.getRange('E:E').setNumberFormat('@');   // 개인코드 앞자리 0 유지
  SpreadsheetApp.getUi && Logger.log('준비 완료: 학생 시트에 명렬표를 적고 makeCodes 를 실행하세요.');
}

/* 비어 있는 개인코드를 4자리 숫자로 채움 (이미 있는 코드는 그대로) */
function makeCodes() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROSTER);
  const v = sh.getDataRange().getValues();
  const used = new Set(v.slice(1).map(row => String(row[4] || '')).filter(Boolean));
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0] || String(v[i][4] || '')) continue;
    let c; do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (used.has(c));
    used.add(c); sh.getRange(i + 1, 5).setValue(c);
  }
}

function sidOf_(g, c, n) { return Number(g) + '-' + Number(c) + '-' + ('0' + Number(n)).slice(-2); }
function roster_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROSTER);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1).filter(r => r[0] && r[1] && r[2])
    .map(r => ({ sid: sidOf_(r[0], r[1], r[2]), grade: Number(r[0]), cls: Number(r[1]), num: Number(r[2]), name: String(r[3] || ''), code: String(r[4] || '') }));
}
function auth_(sid, code) {
  const s = roster_().find(x => x.sid === String(sid));
  return s && s.code && s.code === String(code) ? s : null;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function logRows_(filter) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_LOG);
  if (!sh) return [];
  const v = sh.getDataRange().getValues(), head = v[0];
  return v.slice(1).map(row => { const o = {}; head.forEach((h, i) => o[h] = row[i] instanceof Date ? row[i].getTime() : row[i]); return o; }).filter(filter);
}

function doGet(e) {
  const p = e.parameter || {};
  try {
    if (p.action === 'ping') return out_({ ok: true, app: 'science-lms' });
    if (p.action === 'login') {
      const s = auth_(p.sid, p.code);
      return s ? out_({ ok: true, name: s.name }) : out_({ ok: false, code: 'auth', error: '번호 또는 개인코드가 맞지 않아요' });
    }
    if (p.action === 'student') {
      const s = auth_(p.sid, p.code);
      if (!s) return out_({ ok: false, code: 'auth', error: '번호 또는 개인코드가 맞지 않아요' });
      return out_({ ok: true, name: s.name, rows: logRows_(r => String(r.sid) === s.sid) });
    }
    if (p.action === 'class') {
      if (p.key !== TEACHER_KEY) return out_({ ok: false, code: 'key', error: '교사 비밀번호가 맞지 않아요' });
      const g = Number(p.grade), c = Number(p.cls);
      const ro = roster_().filter(s => (!g || s.grade === g) && (!c || s.cls === c)).map(s => ({ sid: s.sid, grade: s.grade, cls: s.cls, num: s.num, name: s.name }));
      const pre = g ? (g + '-' + (c ? c + '-' : '')) : '';
      return out_({ ok: true, roster: ro, rows: logRows_(r => String(r.sid).indexOf(pre) === 0) });
    }
    if (p.action === 'codes') {   // 교사용: 개인코드 안내 쪽지 인쇄
      if (p.key !== TEACHER_KEY) return out_({ ok: false, code: 'key', error: '교사 비밀번호가 맞지 않아요' });
      const g = Number(p.grade), c = Number(p.cls);
      return out_({ ok: true, roster: roster_().filter(s => (!g || s.grade === g) && (!c || s.cls === c)) });
    }
    return out_({ ok: false, error: '알 수 없는 요청' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: '잘못된 데이터' }); }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_LOG);
    if (!sh) return out_({ ok: false, error: 'setup 을 먼저 실행하세요' });
    let rows = [];
    if (b.action === 'log') {
      const s = auth_(b.sid, b.code);
      if (!s) return out_({ ok: false, code: 'auth', error: '번호 또는 개인코드가 맞지 않아요' });
      rows = (b.rows || []).slice(0, 200).map(r => Object.assign({}, r, { sid: s.sid }));   // 다른 학생 번호로 기록하는 것 방지
    } else if (b.action === 'teacher') {
      if (b.key !== TEACHER_KEY) return out_({ ok: false, code: 'key', error: '교사 비밀번호가 맞지 않아요' });
      rows = (b.rows || []).slice(0, 200);
    } else return out_({ ok: false, error: '알 수 없는 요청' });
    const now = new Date();
    // 학생이 쓴 글이 '=' 등으로 시작하면 수식으로 실행되지 않게 앞에 ' 를 붙임
    const safe = v => (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;
    const vals = rows.map(r => LOG_COLS.map(c => c === 'savedAt' ? now : (r[c] == null ? '' : safe(c === 'answer' ? String(r[c]).slice(0, 1000) : r[c]))));
    if (vals.length) sh.getRange(sh.getLastRow() + 1, 1, vals.length, LOG_COLS.length).setValues(vals);
    return out_({ ok: true, saved: vals.length });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
