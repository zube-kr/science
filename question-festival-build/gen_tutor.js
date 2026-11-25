// code-question-festival.gs 의 "BOOK TUTOR" 구역을 다시 만든다
//   node question-festival-build/gen_tutor.js
// 학생 튜터 카드(question-festival-<id>-data.js)의 요약과 tutor.js 의 책 정보를 AI 지시문용 참고 자료로 넣는다.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TUTOR = require('./tutor.js');
const plain = h => String(h).replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
const out = {};
for (const id of Object.keys(TUTOR)) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, `question-festival-${id}-data.js`), 'utf8'), ctx);
  const D = ctx.BOOKDATA[id], T = TUTOR[id];
  const notes = D.CHAPTERS.map(c => {
    let t = `[${c.lab ? c.lab + ' ' : c.n + '장 '}「${c.ko}」${c.en && !/목차에서/.test(c.en) ? ` (${plain(c.en)})` : ''}] ${plain(c.sum)}`;
    (c.quotes || []).forEach(q => { t += ` [원문] ${q.en ? `"${q.en}" (번역: ${plain(q.ko)})` : `"${plain(q.ko)}"`}`; });
    if (c.find) t += ` [학생 과제: 책에서 찾아보기] ${plain(c.find)}`;
    return t;
  });
  out[id] = { who: T.who, examples: T.examples, balance: T.balance, concepts: T.concepts, finds: T.finds, facts: T.facts, notes };
}
const block = '/* ===== BOOK TUTOR (자동 생성: question-festival-build/gen_tutor.js — 직접 고치지 말고 tutor.js·data.js를 고친 뒤 다시 만드세요) ===== */\n' +
  'const BOOK_TUTOR = ' + JSON.stringify(out, null, 1) + ';\n/* ===== /BOOK TUTOR ===== */';
const gsPath = path.join(ROOT, 'code-question-festival.gs');
let gs = fs.readFileSync(gsPath, 'utf8');
const re = /\/\* ===== BOOK TUTOR[\s\S]*?\/\* ===== \/BOOK TUTOR ===== \*\//;
if (!re.test(gs)) throw new Error('BOOK TUTOR 구역을 찾지 못했어요');
gs = gs.replace(re, () => block);
fs.writeFileSync(gsPath, gs);
console.log('BOOK TUTOR updated:', Object.keys(out).map(k => `${k} ${out[k].notes.length}개`).join(', '), '| chars', block.length);
