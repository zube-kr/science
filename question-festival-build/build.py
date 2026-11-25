# 질문탐구한마당 책 워크시트 만들기
#   python3 question-festival-build/build.py
# template.html(공통 틀)의 {{KEY}} 자리에 책 설정 파일(<id>.txt)의 값을 넣어
# question-festival-<id>.html 을 만든다. 책 장별 카드 내용은 question-festival-<id>-data.js 에 있다.
# 설정 파일 형식: "=== KEY ===" 다음 줄부터 다음 "===" 줄 전까지가 값 (# 로 시작하는 첫 줄은 설명)
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BOOKS = ['spring', 'average', 'sapiens', 'life']

def load(id_):
    cfg, key, buf = {}, None, []
    for line in open(os.path.join(HERE, id_ + '.txt'), encoding='utf-8').read().split('\n'):
        m = re.match(r'^=== ([A-Z0-9_]+) ===$', line)
        if m:
            if key: cfg[key] = '\n'.join(buf).rstrip('\n')
            key, buf = m.group(1), []
        elif key: buf.append(line)
    if key: cfg[key] = '\n'.join(buf).rstrip('\n')
    return cfg

tpl = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
need = set(re.findall(r'\{\{([A-Z0-9_]+)\}\}', tpl))
for id_ in (sys.argv[1:] or BOOKS):
    if not os.path.exists(os.path.join(HERE, id_ + '.txt')): print('skip', id_); continue
    cfg = load(id_)
    miss = need - set(cfg)
    if miss: raise SystemExit(f'{id_}: 설정에 없는 값 {sorted(miss)}')
    out = re.sub(r'\{\{([A-Z0-9_]+)\}\}', lambda m: cfg[m.group(1)], tpl)
    open(os.path.join(ROOT, f'question-festival-{id_}.html'), 'w', encoding='utf-8').write(out)
    print('built', f'question-festival-{id_}.html')
