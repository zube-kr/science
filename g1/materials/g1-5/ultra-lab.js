/* 아두이노 초음파 센서 실험 보고서 공통 (../g1-3/livebook.js 다음에 불러옴)
   스케치: arduino/ultra.ino — "시간(ms),거리(cm)"를 약 0.05초마다 보냄 (9600 baud)
   UL.circuit(id)                  : 회로 표 + 스케치 코드(복사·내려받기)
   UL.points({ root, key, options:[[값, "이름"], …], xName, sample:[[값, 늘어난 길이], …] })
        → 기준 거리(d0)를 정하고, 상태마다 늘어난 길이 = 지금 거리 − d0 를 기록
   UL.stream({ root, key, duration, sample:[[초, 거리], …] })
        → 거리–시간을 연속으로 기록해 거리·속력 그래프를 그림
   UL.rows() : 기록한 값,  UL.onChange(fn) */
(function () {
  var UL = window.UL = { base: "" };
  var $ = function (id) { return document.getElementById(id); };
  var port = null, reader = null, reading = false, recent = [], liveD = NaN, onData = null, rows = [], cfg = null, listeners = [];

  UL.circuit = function (id) {
    $(id).innerHTML =
      '<table class="data-t pin-t"><tr><th>부품</th><th>부품 핀</th><th>아두이노 핀</th></tr>' +
      '<tr><td rowspan="4"><b>초음파 센서</b><br>HC-SR04</td><td>VCC</td><td>5V</td></tr><tr><td>TRIG</td><td>9번</td></tr><tr><td>ECHO</td><td>10번</td></tr><tr><td>GND</td><td>GND</td></tr></table>' +
      '<div class="tip-box"><b>📏 초음파 센서의 원리</b> 센서가 내보낸 초음파가 물체에 부딪혀 돌아오는 시간을 재서 거리를 계산해요(소리의 속력 약 343 m/s). 센서 앞의 <b>평평하고 단단한 면</b>을 겨누어야 정확해요. 2 cm보다 가까우면 잴 수 없어요.</div>' +
      '<div class="al-code"><div class="btn-row" style="margin:0 0 6px"><button type="button" class="btn small" id="ul-copy">📋 코드 복사</button><a class="btn ghost small" href="' + UL.base + 'arduino/ultra.ino" download>⬇️ ultra.ino 내려받기</a></div><pre id="ul-src">코드를 불러오는 중…</pre></div>' +
      '<div class="card-hint">아두이노 IDE에 붙여 넣고 업로드한 뒤 <b>시리얼 모니터는 닫고</b> 아래 [아두이노 연결하기]를 눌러요.</div>';
    fetch(UL.base + "arduino/ultra.ino").then(function (r) { return r.text(); }).then(function (t) { $("ul-src").textContent = t; }).catch(function () { $("ul-src").textContent = "코드를 불러오지 못했어요. 위의 내려받기 버튼을 눌러 주세요."; });
    $("ul-copy").addEventListener("click", function () { var t = $("ul-src").textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $("ul-copy").textContent = "✅ 복사됨"; setTimeout(function () { $("ul-copy").textContent = "📋 코드 복사"; }, 1500); }).catch(function () {}); });
  };

  function connBar() {
    return '<div class="al-conn"><button type="button" class="btn main small" id="ul-connect">🔌 아두이노 연결하기</button><span class="al-dot" id="ul-dot"></span><span id="ul-ctext" style="font-size:13px;font-weight:700">연결 안 됨</span>' +
      '<span style="font-size:12px;color:var(--ink-soft)">크롬·엣지에서 연결돼요. 연결이 어려우면 거리 칸에 자로 잰 값을 직접 넣어도 돼요.</span></div>';
  }
  function wireConn() { $("ul-connect").addEventListener("click", function () { reading ? disconnect() : connect(); }); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
  function live() { var v = parseFloat($("ul-d").value); return isNaN(v) ? NaN : v; }
  function changed() { listeners.forEach(function (f) { f(rows); }); }

  /* ── 상태별 기록(용수철·부력) ── */
  UL.points = function (c) {
    cfg = c; rows = []; var d0 = null;
    $(c.root).innerHTML = connBar() +
      '<div class="al-live"><div class="al-box" style="border-color:#2f7de1"><small>📏 센서 ~ 카드 거리 (cm)</small><input type="number" step="0.1" id="ul-d" placeholder="cm"></div>' +
      '<div class="al-box" style="border-color:#e4572e"><small>기준 거리 d₀ (cm)</small><input type="number" step="0.1" id="ul-d0" placeholder="먼저 정하기" readonly></div></div>' +
      '<div class="btn-row"><button type="button" class="btn small" id="ul-zero">0️⃣ 지금 거리를 기준(d₀)으로</button><select id="ul-x" style="font-size:14px;padding:4px 6px;border-radius:8px">' + c.options.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select><button type="button" class="btn main small" id="ul-rec">📍 늘어난 길이 기록</button><button type="button" class="btn ghost small" id="ul-sample">📎 예시 값으로 미리보기</button><button type="button" class="btn ghost small" id="ul-clear">🧹 표 초기화</button></div>' +
      '<div class="fig-row" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:start"><div class="scroll-x"><table class="data-t" id="ul-tb"></table></div><div class="light-stage"><canvas id="ul-g"></canvas></div></div>';
    wireConn();
    onData = function (t, d) { recent.push(d); if (recent.length > 7) recent.shift(); $("ul-d").value = median(recent).toFixed(1); };
    $("ul-zero").addEventListener("click", function () { var v = live(); if (isNaN(v)) { alert("거리 값이 아직 없어요."); return; } d0 = v; $("ul-d0").value = v.toFixed(1); });
    $("ul-rec").addEventListener("click", function () { var v = live(); if (d0 == null) { alert("먼저 [지금 거리를 기준(d₀)으로]를 눌러 기준 거리를 정해요."); return; } if (isNaN(v)) { alert("거리 값이 아직 없어요."); return; } var x = +$("ul-x").value; rows = rows.filter(function (r) { return r[0] !== x; }); rows.push([x, +(v - d0).toFixed(1)]); rows.sort(function (a, b) { return a[0] - b[0]; }); draw(); });
    $("ul-sample").addEventListener("click", function () { d0 = 20; $("ul-d0").value = "20.0"; rows = c.sample.map(function (r) { return r.slice(); }); draw(); });
    $("ul-clear").addEventListener("click", function () { if (rows.length && !confirm("기록을 모두 지울까요?")) return; rows = []; draw(); });
    function draw() {
      var name = function (x) { var o = c.options.filter(function (o) { return o[0] === x; })[0]; return o ? o[1] : x; };
      $("ul-tb").innerHTML = '<tr><th>' + c.xName + '</th><th>늘어난 길이(cm)</th></tr>' + (rows.length ? rows.map(function (r) { return '<tr><td>' + name(r[0]) + '</td><td>' + r[1].toFixed(1) + '</td></tr>'; }).join("") : '<tr><td colspan="2" style="color:#8a9a9c">아직 기록이 없어요</td></tr>');
      if (c.graph) c.graph($("ul-g"), rows); changed();
    }
    if (window.WS) WS.custom(c.key, { el: $(c.root), value: function () { return rows.map(function (r) { return r[0] + ":" + r[1]; }).join(" "); } });
    draw();
  };

  /* ── 연속 기록(운동) ── */
  UL.stream = function (c) {
    cfg = c; rows = []; var t0 = null, rec = false;
    $(c.root).innerHTML = connBar() +
      '<div class="al-live"><div class="al-box" style="border-color:#2f7de1"><small>📏 센서 ~ 물체 거리 (cm)</small><input type="number" step="0.1" id="ul-d" placeholder="cm" readonly></div></div>' +
      '<div class="btn-row"><button type="button" class="btn main small" id="ul-go">▶ 기록 시작 (' + c.duration + '초)</button><button type="button" class="btn ghost small" id="ul-sample">📎 예시 값으로 미리보기</button><span class="al-clock" id="ul-clock">0.0초</span></div>' +
      '<div class="light-stage"><canvas id="ul-g1"></canvas></div><div class="light-stage" style="margin-top:8px"><canvas id="ul-g2"></canvas></div>' +
      '<div class="scroll-x" style="margin-top:8px"><table class="data-t" id="ul-tb"></table></div>';
    wireConn();
    onData = function (t, d) { $("ul-d").value = d.toFixed(1); if (!rec) return; if (t0 == null) t0 = t; var s = (t - t0) / 1000; if (s > c.duration) { rec = false; $("ul-go").textContent = "▶ 다시 기록 (" + c.duration + "초)"; draw(); return; } rows.push([+s.toFixed(3), d]); $("ul-clock").textContent = s.toFixed(1) + "초"; if (rows.length % 4 === 0) draw(); };
    $("ul-go").addEventListener("click", function () { if (!reading) { alert("아두이노를 먼저 연결해요. 연결 없이 보려면 [예시 값으로 미리보기]를 눌러요."); return; } rows = []; t0 = null; rec = true; $("ul-go").textContent = "● 기록 중…"; });
    $("ul-sample").addEventListener("click", function () { rec = false; rows = c.sample.map(function (r) { return r.slice(); }); draw(); });
    function draw() {
      var sp = UL.speeds();
      LB.graph($("ul-g1"), { h: 200, xMax: c.duration, yMin: 0, yMax: c.yMax || 120, xStep: 0.5, yStep: 20, xLabel: "시간(초)", yLabel: "거리(cm)", series: [{ color: "#2f7de1", pts: rows }] });
      LB.graph($("ul-g2"), { h: 200, xMax: c.duration, yMin: 0, yMax: c.vMax || 150, xStep: 0.5, yStep: 25, xLabel: "시간(초)", yLabel: "속력(cm/s)", series: [{ color: "#e4572e", pts: sp, dots: true }] });
      $("ul-tb").innerHTML = '<tr><th>시간(초)</th>' + sp.map(function (p) { return '<th>' + p[0].toFixed(1) + '</th>'; }).join("") + '</tr><tr><td>속력(cm/s)</td>' + sp.map(function (p) { return '<td>' + p[1].toFixed(0) + '</td>'; }).join("") + '</tr>';
      changed();
    }
    if (window.WS) WS.custom(c.key, { el: $(c.root), value: function () { return UL.speeds().map(function (p) { return p[0].toFixed(1) + ":" + p[1].toFixed(0); }).join(" "); } });
    draw();
  };
  // 0.5초 구간마다 평균 속력(cm/s)
  UL.speeds = function () {
    var out = []; if (rows.length < 2) return out;
    var end = rows[rows.length - 1][0];
    for (var a = 0; a + 0.5 <= end + 1e-6; a += 0.5) {
      var near = function (t) { var best = rows[0]; rows.forEach(function (r) { if (Math.abs(r[0] - t) < Math.abs(best[0] - t)) best = r; }); return best; };
      var p = near(a), q = near(a + 0.5); if (q[0] - p[0] < 0.2) continue;
      out.push([a + 0.25, Math.abs(q[1] - p[1]) / (q[0] - p[0])]);
    }
    return out;
  };

  // ── Web Serial ──
  function setUI(on) { $("ul-dot").classList.toggle("on", on); $("ul-ctext").textContent = on ? "실시간 연결됨" : "연결 안 됨"; $("ul-connect").textContent = on ? "🔌 연결 끊기" : "🔌 아두이노 연결하기"; var d = $("ul-d"); if (d && on) d.readOnly = true; }
  async function connect() {
    if (!("serial" in navigator)) { alert("이 브라우저는 아두이노 직접 연결(Web Serial)을 지원하지 않아요. 크롬이나 엣지를 사용해 주세요."); return; }
    try { port = await navigator.serial.requestPort(); await port.open({ baudRate: 9600 }); reading = true; setUI(true); readLoop(); }
    catch (e) { if (e && e.name !== "NotFoundError") alert("아두이노 연결에 실패했어요. USB와 시리얼 모니터를 확인해 주세요."); }
  }
  async function disconnect() { reading = false; try { if (reader) await reader.cancel(); } catch (e) {} try { if (port) await port.close(); } catch (e) {} port = null; reader = null; setUI(false); }
  async function readLoop() {
    var dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable).catch(function () {});
    reader = dec.readable.getReader(); var buf = "";
    try { while (reading) { var r = await reader.read(); if (r.done) break; buf += r.value || ""; var i; while ((i = buf.indexOf("\n")) >= 0) { var p = buf.slice(0, i).trim().split(","); buf = buf.slice(i + 1); var t = parseFloat(p[0]), d = parseFloat(p[1]); if (!isNaN(t) && !isNaN(d) && d > 1 && d < 400 && onData) onData(t, d); } } }
    catch (e) { console.error(e); } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  UL.rows = function () { return rows; };
  UL.onChange = function (f) { listeners.push(f); };
})();
