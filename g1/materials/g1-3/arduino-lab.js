/* 아두이노 실험 보고서 공통 — 온도 센서 2개(LM35 + 써미스터)를 Web Serial로 받아 기록·그래프로 그리기
   AL.setup({ root, key, ch:[이름1, 이름2], every:초, duration:초, yMin, yMax, sample:[[초, 값1, 값2], …] })
   AL.rows()            : 기록한 [초, 값1, 값2] 목록
   AL.onChange(fn)      : 기록이 바뀔 때마다 fn(rows) 호출
   스케치는 arduino/heat-2ch.ino ("값1,값2" 줄을 1초마다 보냄, 9600 baud)
   다른 단원 폴더에서 쓸 때는 AL.base = "../g1-3/" 처럼 이 파일이 있는 폴더를 먼저 알려 준다. */
(function () {
  var AL = window.AL = { base: "" };
  var rows = [], cfg, listeners = [], live = [NaN, NaN], port = null, reader = null, reading = false, auto = null, t0 = 0;
  var $ = function (id) { return document.getElementById(id); };
  var COL = ["#e4572e", "#2f7de1"];

  function fmtT(s) { var m = Math.floor(s / 60), r = Math.round(s % 60); return m + ":" + (r < 10 ? "0" : "") + r; }
  function off(i) { var v = parseFloat($("al-off" + i).value); return isNaN(v) ? 0 : v; }
  function cur(i) { var v = parseFloat($("al-v" + i).value); return isNaN(v) ? NaN : v; }

  AL.setup = function (c) {
    cfg = c;
    var root = $(c.root);
    root.innerHTML =
      '<div class="al-conn"><button type="button" class="btn main small" id="al-connect">🔌 아두이노 연결하기</button>' +
      '<span class="al-dot" id="al-dot"></span><span id="al-ctext" style="font-size:13px;font-weight:700">연결 안 됨</span>' +
      '<span style="font-size:12px;color:var(--ink-soft)">크롬·엣지 브라우저에서 연결돼요. 연결이 어려우면 아래 칸에 값을 직접 넣어도 돼요.</span></div>' +
      '<div class="al-live">' + [0, 1].map(function (i) {
        return '<div class="al-box" style="border-color:' + COL[i] + '"><small>' + (i ? "🔵" : "🔴") + ' 센서 ' + (i + 1) + ' · ' + c.ch[i] + '</small>' +
          '<input type="number" step="0.1" id="al-v' + i + '" placeholder="℃"><label>보정 <input type="number" step="0.1" id="al-off' + i + '" value="0"> ℃</label></div>';
      }).join("") + '</div>' +
      '<div class="tip-box" style="margin:6px 0"><b>보정하기</b> — 실험 전에 두 센서를 같은 물에 함께 넣고 알코올 온도계와 비교해 보세요. 센서 값이 온도계보다 0.8 ℃ 높으면 보정 칸에 −0.8을 넣어요.</div>' +
      '<div class="btn-row"><button type="button" class="btn main small" id="al-auto">▶ 자동 기록 시작 (' + c.every + '초마다)</button>' +
      '<button type="button" class="btn small" id="al-rec">📍 지금 값 기록</button>' +
      '<button type="button" class="btn ghost small" id="al-sample">📎 예시 값으로 미리보기</button>' +
      '<button type="button" class="btn ghost small" id="al-clear">🧹 표 초기화</button>' +
      '<span class="al-clock" id="al-clock">0:00</span></div>' +
      '<div class="light-stage"><canvas id="al-graph"></canvas></div>' +
      '<div class="scroll-x" style="max-height:260px;overflow-y:auto;margin-top:8px"><table class="data-t" id="al-table"></table></div>';
    $("al-connect").addEventListener("click", function () { reading ? disconnect() : connect(); });
    $("al-auto").addEventListener("click", toggleAuto);
    $("al-rec").addEventListener("click", function () { record(rows.length ? rows[rows.length - 1][0] + c.every : 0); });
    $("al-sample").addEventListener("click", function () { stopAuto(); rows = c.sample.map(function (r) { return r.slice(); }); changed(); });
    $("al-clear").addEventListener("click", function () { if (rows.length && !confirm("기록한 값을 모두 지울까요?")) return; stopAuto(); rows = []; changed(); });
    $("al-table").addEventListener("click", function (e) { var b = e.target.closest("[data-del]"); if (!b) return; rows.splice(+b.dataset.del, 1); changed(); });
    window.addEventListener("resize", draw);
    if (window.WS) WS.custom(c.key, { el: root, value: function () { return rows.map(function (r) { return r[0] + ":" + r[1] + "/" + r[2]; }).join(" "); } });
    changed();
  };

  function record(t) {
    var a = cur(0), b = cur(1);
    if (isNaN(a) && isNaN(b)) { alert("센서 값이 아직 없어요. 아두이노를 연결하거나 칸에 값을 직접 넣어 주세요."); return false; }
    rows.push([Math.round(t), isNaN(a) ? null : +(a + off(0)).toFixed(1), isNaN(b) ? null : +(b + off(1)).toFixed(1)]);
    changed(); return true;
  }
  function toggleAuto() { auto ? stopAuto() : startAuto(); }
  function startAuto() {
    if (isNaN(cur(0)) && isNaN(cur(1))) { alert("센서 값이 아직 없어요. 아두이노를 연결하거나 칸에 값을 직접 넣어 주세요."); return; }
    rows = []; t0 = Date.now(); record(0);
    $("al-auto").textContent = "■ 기록 멈추기";
    auto = setInterval(function () {
      var s = (Date.now() - t0) / 1000; $("al-clock").textContent = fmtT(s);
      var next = rows.length ? rows[rows.length - 1][0] + cfg.every : 0;
      if (s >= next - 0.05) record(next);
      if (s >= cfg.duration) stopAuto();
    }, 250);
  }
  function stopAuto() { if (auto) clearInterval(auto); auto = null; if ($("al-auto")) $("al-auto").textContent = "▶ 자동 기록 시작 (" + cfg.every + "초마다)"; }

  function changed() { table(); draw(); listeners.forEach(function (f) { f(rows); }); }
  function table() {
    var h = '<tr><th>#</th><th>시간</th><th>🔴 ' + cfg.ch[0] + '(℃)</th><th>🔵 ' + cfg.ch[1] + '(℃)</th><th>온도 차이(℃)</th><th></th></tr>';
    if (!rows.length) h += '<tr><td colspan="6" style="color:#8a9a9c">아직 기록된 값이 없어요.</td></tr>';
    rows.forEach(function (r, i) {
      var d = r[1] != null && r[2] != null ? Math.abs(r[1] - r[2]).toFixed(1) : "";
      h += '<tr><td>' + (i + 1) + '</td><td>' + fmtT(r[0]) + '</td><td>' + (r[1] == null ? "" : r[1].toFixed(1)) + '</td><td>' + (r[2] == null ? "" : r[2].toFixed(1)) + '</td><td>' + d + '</td><td><button type="button" class="al-del" data-del="' + i + '">✕</button></td></tr>';
    });
    $("al-table").innerHTML = h;
  }
  function draw() {
    if (!window.LB) return;
    var xMax = Math.max(cfg.duration, rows.length ? rows[rows.length - 1][0] : 0) / 60;
    LB.graph($("al-graph"), { h: 260, xMax: xMax, yMin: cfg.yMin, yMax: cfg.yMax, xStep: xMax > 6 ? 1 : 0.5, yStep: cfg.yStep || 10, xLabel: "시간(분)", yLabel: "온도(℃)",
      series: [0, 1].map(function (k) { return { color: COL[k], dots: true, label: cfg.ch[k], labelDy: k ? 18 : 0, pts: rows.filter(function (r) { return r[k + 1] != null; }).map(function (r) { return [r[0] / 60, r[k + 1]]; }) }; }) });
  }

  // ── Web Serial ──
  function setUI(on) { $("al-dot").classList.toggle("on", on); $("al-ctext").textContent = on ? "실시간 연결됨" : "연결 안 됨"; $("al-connect").textContent = on ? "🔌 연결 끊기" : "🔌 아두이노 연결하기"; }
  async function connect() {
    if (!("serial" in navigator)) { alert("이 브라우저는 아두이노 직접 연결(Web Serial)을 지원하지 않아요. 크롬이나 엣지를 사용해 주세요.\n연결 없이도 칸에 값을 직접 넣어 실험할 수 있어요."); return; }
    try { port = await navigator.serial.requestPort(); await port.open({ baudRate: 9600 }); reading = true; setUI(true); readLoop(); }
    catch (e) { if (e && e.name !== "NotFoundError") alert("아두이노 연결에 실패했어요. USB가 잘 꽂혀 있는지, 아두이노 IDE의 시리얼 모니터가 켜져 있지 않은지 확인해 주세요."); }
  }
  async function disconnect() {
    reading = false;
    try { if (reader) await reader.cancel(); } catch (e) {}
    try { if (port) await port.close(); } catch (e) {}
    port = null; reader = null; setUI(false);
  }
  async function readLoop() {
    var dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable).catch(function () {});
    reader = dec.readable.getReader(); var buf = "";
    try {
      while (reading) {
        var r = await reader.read(); if (r.done) break; buf += r.value || "";
        var i; while ((i = buf.indexOf("\n")) >= 0) { parse(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
      }
    } catch (e) { console.error(e); } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  function parse(line) {
    var p = line.split(","); if (p.length < 2) return;
    [0, 1].forEach(function (k) { var v = parseFloat(p[k]); if (!isNaN(v) && v > -50) { live[k] = v; $("al-v" + k).value = v.toFixed(1); } });
  }

  // 회로 표 + 스케치 코드(복사·내려받기)
  AL.circuit = function (id) {
    var el = $(id);
    el.innerHTML =
      '<table class="data-t pin-t"><tr><th>부품</th><th>부품 핀</th><th>아두이노 핀</th></tr>' +
      '<tr><td rowspan="3"><b>센서 1</b><br>LM35 온도 센서</td><td>VCC (+)</td><td>5V</td></tr><tr><td>OUT (가운데)</td><td>A0</td></tr><tr><td>GND (−)</td><td>GND</td></tr>' +
      '<tr><td rowspan="3"><b>센서 2</b><br>써미스터 (NTC 10 kΩ)<br><small>또는 37종 키트 아날로그 온도 센서 모듈</small></td><td>한쪽 다리 (모듈: S)</td><td>A1 · 10 kΩ 저항을 거쳐 5V</td></tr><tr><td>다른 쪽 다리 (모듈: −)</td><td>GND</td></tr><tr><td>(모듈만: 가운데 +)</td><td>5V</td></tr></table>' +
      '<div class="tip-box"><b>💧 방수가 먼저!</b> 센서를 물에 넣을 때는 다리(핀)와 전선 연결 부분을 랩이나 열수축 튜브로 감싸고, 끝부분(감지부)만 물에 닿게 해요. 아두이노와 브레드보드는 물에서 멀리 두어요.</div>' +
      '<div class="al-code"><div class="btn-row" style="margin:0 0 6px"><button type="button" class="btn small" id="al-copy">📋 코드 복사</button><a class="btn ghost small" href="' + AL.base + 'arduino/heat-2ch.ino" download>⬇️ heat-2ch.ino 내려받기</a></div><pre id="al-src">코드를 불러오는 중…</pre></div>' +
      '<div class="card-hint">아두이노 IDE에 붙여 넣고 업로드한 뒤 <b>시리얼 모니터는 닫고</b> 아래 [아두이노 연결하기]를 눌러요. 써미스터를 손으로 쥐었는데 온도가 내려가면 코드의 <code>NTC_REVERSED</code>를 1로 바꿔요.</div>';
    fetch(AL.base + "arduino/heat-2ch.ino").then(function (r) { return r.text(); }).then(function (t) { $("al-src").textContent = t; }).catch(function () { $("al-src").textContent = "코드를 불러오지 못했어요. 위의 내려받기 버튼을 눌러 주세요."; });
    $("al-copy").addEventListener("click", function () {
      var t = $("al-src").textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $("al-copy").textContent = "✅ 복사됨"; setTimeout(function () { $("al-copy").textContent = "📋 코드 복사"; }, 1500); })
        .catch(function () { var r = document.createRange(); r.selectNodeContents($("al-src")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    });
  };

  AL.rows = function () { return rows; };
  AL.onChange = function (f) { listeners.push(f); };
  AL.fmt = fmtT;
})();
