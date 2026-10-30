/* 아두이노 빛 센서(CDS) 실험 보고서 공통 (../g1-3/livebook.js 다음에 불러옴)
   스케치: arduino/light.ino — "시간(ms),밝기(0~1023)"를 약 0.05초마다 보냄 (9600 baud)
   LL.circuit(id)          : 회로 표 + 스케치 코드(복사·내려받기)
   LL.points({ root, key, options:[[값, "이름"], …], xName, sample:[[값, 밝기%], …], graph(cv, rows) })
        → 기준 밝기(100 %)를 정하고, 위치마다 밝기(%)를 기록
   LL.stream({ root, key, duration, sample:[[초, 밝기%], …] })
        → 밝기–시간을 연속으로 기록
   밝기(%) = 지금 센서 값 ÷ 기준 센서 값 × 100.  LL.rows(), LL.onChange(fn) */
(function () {
  var LL = window.LL = { base: "" };
  var $ = function (id) { return document.getElementById(id); };
  var port = null, reader = null, reading = false, recent = [], onData = null, rows = [], listeners = [], ref = null;

  LL.circuit = function (id) {
    $(id).innerHTML =
      '<table class="data-t pin-t"><tr><th>부품</th><th>연결</th><th>아두이노 핀</th></tr>' +
      '<tr><td rowspan="2"><b>빛 센서</b><br>CDS(조도 센서)</td><td>한쪽 다리</td><td>5V</td></tr><tr><td>다른 쪽 다리</td><td>A0</td></tr>' +
      '<tr><td><b>저항</b> 10 kΩ</td><td>A0와 GND 사이</td><td>A0 ↔ GND</td></tr></table>' +
      '<div class="tip-box"><b>💡 빛 센서의 원리</b> CDS는 빛을 많이 받을수록 전기가 잘 통해요. 그래서 밝을수록 A0의 값(0~1023)이 커져요. 빛 센서 모듈(S, +, −)을 쓴다면 S → A0, + → 5V, − → GND로 연결해요(모듈에 따라 어두울수록 값이 커질 수 있으니 먼저 손으로 가려 확인!).</div>' +
      '<div class="al-code"><div class="btn-row" style="margin:0 0 6px"><button type="button" class="btn small" id="ll-copy">📋 코드 복사</button><a class="btn ghost small" href="' + LL.base + 'arduino/light.ino" download>⬇️ light.ino 내려받기</a></div><pre id="ll-src">코드를 불러오는 중…</pre></div>' +
      '<div class="card-hint">아두이노 IDE에 붙여 넣고 업로드한 뒤 <b>시리얼 모니터는 닫고</b> 아래 [아두이노 연결하기]를 눌러요.</div>';
    fetch(LL.base + "arduino/light.ino").then(function (r) { return r.text(); }).then(function (t) { $("ll-src").textContent = t; }).catch(function () { $("ll-src").textContent = "코드를 불러오지 못했어요. 위의 내려받기 버튼을 눌러 주세요."; });
    $("ll-copy").addEventListener("click", function () { var t = $("ll-src").textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $("ll-copy").textContent = "✅ 복사됨"; setTimeout(function () { $("ll-copy").textContent = "📋 코드 복사"; }, 1500); }).catch(function () {}); });
  };

  function connBar() {
    return '<div class="al-conn"><button type="button" class="btn main small" id="ll-connect">🔌 아두이노 연결하기</button><span class="al-dot" id="ll-dot"></span><span id="ll-ctext" style="font-size:13px;font-weight:700">연결 안 됨</span>' +
      '<span style="font-size:12px;color:var(--ink-soft)">크롬·엣지에서 연결돼요. 연결이 어려우면 센서 값 칸에 직접 넣어도 돼요.</span></div>';
  }
  function liveBoxes() {
    return '<div class="al-live"><div class="al-box" style="border-color:#e4a11b"><small>💡 지금 센서 값 (0~1023)</small><input type="number" step="1" id="ll-v" placeholder="0~1023"></div>' +
      '<div class="al-box" style="border-color:#2f7de1"><small>기준 값 (100 %)</small><input type="number" step="1" id="ll-ref" placeholder="먼저 정하기"></div>' +
      '<div class="al-box" style="border-color:#2fae5d"><small>밝기 (%)</small><input type="text" id="ll-pct" readonly></div></div>';
  }
  function wireConn() { $("ll-connect").addEventListener("click", function () { reading ? disconnect() : connect(); }); }
  function live() { var v = parseFloat($("ll-v").value); return isNaN(v) ? NaN : v; }
  function getRef() { var v = parseFloat($("ll-ref").value); return isNaN(v) || v <= 0 ? null : v; }
  function pct(v) { var r = getRef(); return r ? v / r * 100 : NaN; }
  function showPct() { var p = pct(live()); $("ll-pct").value = isNaN(p) ? "-" : p.toFixed(0) + " %"; }
  function changed() { listeners.forEach(function (f) { f(rows); }); }
  function wireLive() { $("ll-v").addEventListener("input", showPct); $("ll-ref").addEventListener("input", showPct); }

  /* ── 위치별 기록 ── */
  LL.points = function (c) {
    rows = [];
    $(c.root).innerHTML = connBar() + liveBoxes() +
      '<div class="btn-row"><button type="button" class="btn small" id="ll-setref">💯 지금 값을 기준(100 %)으로</button><select id="ll-x" style="font-size:14px;padding:4px 6px;border-radius:8px">' + c.options.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select><button type="button" class="btn main small" id="ll-rec">📍 밝기 기록</button><button type="button" class="btn ghost small" id="ll-sample">📎 예시 값으로 미리보기</button><button type="button" class="btn ghost small" id="ll-clear">🧹 표 초기화</button></div>' +
      '<div class="fig-row" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:start"><div class="scroll-x"><table class="data-t" id="ll-tb"></table></div><div class="light-stage"><canvas id="ll-g"></canvas></div></div>';
    wireConn(); wireLive();
    onData = function (t, v) { recent.push(v); if (recent.length > 9) recent.shift(); var s = recent.slice().sort(function (a, b) { return a - b; }); $("ll-v").value = s[Math.floor(s.length / 2)]; showPct(); };
    $("ll-setref").addEventListener("click", function () { var v = live(); if (isNaN(v) || v <= 0) { alert("센서 값이 아직 없어요."); return; } $("ll-ref").value = Math.round(v); showPct(); });
    $("ll-rec").addEventListener("click", function () { var v = live(); if (!getRef()) { alert("먼저 기준 값(100 %)을 정해요."); return; } if (isNaN(v)) { alert("센서 값이 아직 없어요."); return; } var x = +$("ll-x").value; rows = rows.filter(function (r) { return r[0] !== x; }); rows.push([x, +pct(v).toFixed(1), Math.round(v)]); rows.sort(function (a, b) { return a[0] - b[0]; }); draw(); });
    $("ll-sample").addEventListener("click", function () { $("ll-ref").value = 800; rows = c.sample.map(function (r) { return [r[0], r[1], Math.round(r[1] * 8)]; }); draw(); showPct(); });
    $("ll-clear").addEventListener("click", function () { if (rows.length && !confirm("기록을 모두 지울까요?")) return; rows = []; draw(); });
    function draw() {
      var name = function (x) { var o = c.options.filter(function (o) { return o[0] === x; })[0]; return o ? o[1] : x; };
      $("ll-tb").innerHTML = '<tr><th>' + c.xName + '</th><th>센서 값</th><th>밝기(%)</th></tr>' + (rows.length ? rows.map(function (r) { return '<tr><td>' + name(r[0]) + '</td><td>' + r[2] + '</td><td>' + r[1].toFixed(1) + '</td></tr>'; }).join("") : '<tr><td colspan="3" style="color:#8a9a9c">아직 기록이 없어요</td></tr>');
      if (c.graph) c.graph($("ll-g"), rows); changed();
    }
    if (window.WS) WS.custom(c.key, { el: $(c.root), value: function () { return rows.map(function (r) { return r[0] + ":" + r[1]; }).join(" "); } });
    draw();
  };

  /* ── 연속 기록 ── */
  LL.stream = function (c) {
    rows = []; var t0 = null, rec = false;
    $(c.root).innerHTML = connBar() + liveBoxes() +
      '<div class="btn-row"><button type="button" class="btn small" id="ll-setref">💯 지금 값을 기준(100 %)으로</button><button type="button" class="btn main small" id="ll-go">▶ 기록 시작 (' + c.duration + '초)</button><button type="button" class="btn ghost small" id="ll-sample">📎 예시 값으로 미리보기</button><span class="al-clock" id="ll-clock">0.0초</span></div>' +
      '<div class="light-stage"><canvas id="ll-g"></canvas></div><table class="data-t" id="ll-tb" style="margin-top:8px"></table>';
    wireConn(); wireLive();
    onData = function (t, v) { $("ll-v").value = v; showPct(); if (!rec) return; if (t0 == null) t0 = t; var s = (t - t0) / 1000; if (s > c.duration) { rec = false; $("ll-go").textContent = "▶ 다시 기록 (" + c.duration + "초)"; draw(); return; } var p = pct(v); if (!isNaN(p)) rows.push([+s.toFixed(3), +p.toFixed(1)]); $("ll-clock").textContent = s.toFixed(1) + "초"; if (rows.length % 4 === 0) draw(); };
    $("ll-setref").addEventListener("click", function () { var v = live(); if (isNaN(v) || v <= 0) { alert("센서 값이 아직 없어요."); return; } $("ll-ref").value = Math.round(v); showPct(); });
    $("ll-go").addEventListener("click", function () { if (!reading) { alert("아두이노를 먼저 연결해요. 연결 없이 보려면 [예시 값으로 미리보기]를 눌러요."); return; } if (!getRef()) { alert("먼저 기준 값(100 %)을 정해요."); return; } rows = []; t0 = null; rec = true; $("ll-go").textContent = "● 기록 중…"; });
    $("ll-sample").addEventListener("click", function () { rec = false; $("ll-ref").value = 800; rows = c.sample.map(function (r) { return r.slice(); }); draw(); });
    function draw() {
      LB.graph($("ll-g"), { h: 230, xMax: c.duration, yMin: 0, yMax: 120, xStep: 1, yStep: 20, xLabel: "시간(초)", yLabel: "밝기(%)", series: [{ color: "#e4a11b", pts: rows }] });
      var st = LL.stats();
      $("ll-tb").innerHTML = '<tr><th>가장 어두웠을 때 밝기</th><th>가장 어두웠던 시각</th><th>밝기가 90 % 아래였던 시간</th></tr><tr><td>' + (st ? st.min.toFixed(0) + " %" : "-") + '</td><td>' + (st ? st.tmin.toFixed(1) + " 초" : "-") + '</td><td>' + (st ? st.dur.toFixed(1) + " 초" : "-") + '</td></tr>';
      changed();
    }
    if (window.WS) WS.custom(c.key, { el: $(c.root), value: function () { var st = LL.stats(); return st ? "min:" + st.min.toFixed(0) + " dur:" + st.dur.toFixed(1) : ""; } });
    draw();
  };
  LL.stats = function () {
    if (rows.length < 3) return null; var m = rows[0];
    rows.forEach(function (r) { if (r[1] < m[1]) m = r; });
    var dur = 0; for (var i = 1; i < rows.length; i++) if (rows[i][1] < 90) dur += rows[i][0] - rows[i - 1][0];
    return { min: m[1], tmin: m[0], dur: dur };
  };

  // ── Web Serial ──
  function setUI(on) { $("ll-dot").classList.toggle("on", on); $("ll-ctext").textContent = on ? "실시간 연결됨" : "연결 안 됨"; $("ll-connect").textContent = on ? "🔌 연결 끊기" : "🔌 아두이노 연결하기"; $("ll-v").readOnly = on; }
  async function connect() {
    if (!("serial" in navigator)) { alert("이 브라우저는 아두이노 직접 연결(Web Serial)을 지원하지 않아요. 크롬이나 엣지를 사용해 주세요."); return; }
    try { port = await navigator.serial.requestPort(); await port.open({ baudRate: 9600 }); reading = true; setUI(true); readLoop(); }
    catch (e) { if (e && e.name !== "NotFoundError") alert("아두이노 연결에 실패했어요. USB와 시리얼 모니터를 확인해 주세요."); }
  }
  async function disconnect() { reading = false; try { if (reader) await reader.cancel(); } catch (e) {} try { if (port) await port.close(); } catch (e) {} port = null; reader = null; setUI(false); }
  async function readLoop() {
    var dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable).catch(function () {});
    reader = dec.readable.getReader(); var buf = "";
    try { while (reading) { var r = await reader.read(); if (r.done) break; buf += r.value || ""; var i; while ((i = buf.indexOf("\n")) >= 0) { var p = buf.slice(0, i).trim().split(","); buf = buf.slice(i + 1); var t = parseFloat(p[0]), v = parseFloat(p[1]); if (!isNaN(t) && !isNaN(v) && v >= 0 && v <= 1023 && onData) onData(t, v); } } }
    catch (e) { console.error(e); } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  LL.rows = function () { return rows; };
  LL.onChange = function (f) { listeners.push(f); };
})();
