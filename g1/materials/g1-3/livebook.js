/* 살아있는 교과서 — 중1 Ⅲ. 열 공통 도우미
   LB.fit(canvas, h)          : 화면 폭에 맞게 캔버스 크기 맞추기(고해상도)
   LB.graph(canvas, opts)     : 시간-온도 같은 선그래프 그리기
   LB.heat(t)                 : 0~1 값을 열화상 색으로
   LB.orbit(cam, el, target)  : three.js 카메라를 드래그로 돌리기
   LB.three(el, h)            : three.js 장면 만들기 (WebGL이 없으면 null) */
(function () {
  var LB = window.LB = {};

  // 교과서 그림 크게 보기
  function setupLight() {
    var box = document.createElement("div"); box.id = "lb-light";
    box.innerHTML = '<img alt="">';
    document.body.appendChild(box);
    box.addEventListener("click", function () { box.classList.remove("on"); });
    document.addEventListener("click", function (e) {
      var img = e.target.closest && e.target.closest(".fig img");
      if (!img) return;
      box.querySelector("img").src = img.src; box.classList.add("on");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupLight); else setupLight();

  LB.fit = function (cv, h) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || cv.parentNode.clientWidth || 600;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + "px";
    var c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: w, h: h };
  };

  // opts: { xMax, yMin, yMax, xLabel, yLabel, series:[{color, pts:[[x,y]], label}], marks:[{y, text, color}], vline }
  LB.graph = function (cv, o) {
    var g = LB.fit(cv, o.h || 260), c = g.c, W = g.w, H = g.h;
    var L = 44, R = 14, T = 16, B = 34;
    var X = function (x) { return L + x / o.xMax * (W - L - R); };
    var Y = function (y) { return H - B - (y - o.yMin) / (o.yMax - o.yMin) * (H - T - B); };
    c.clearRect(0, 0, W, H); c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    c.font = "11px Pretendard, sans-serif"; c.fillStyle = "#6b7b85"; c.strokeStyle = "#e6ecee"; c.lineWidth = 1;
    var ys = o.yStep || 10, xs = o.xStep || 1;
    for (var y = Math.ceil(o.yMin / ys) * ys; y <= o.yMax; y += ys) { c.beginPath(); c.moveTo(L, Y(y)); c.lineTo(W - R, Y(y)); c.stroke(); c.fillText(String(Math.round(y * 1000) / 1000), 8, Y(y) + 4); }
    for (var x = 0; x <= o.xMax + 1e-9; x += xs) { c.fillText(String(Math.round(x * 10) / 10), X(x) - 6, H - B + 15); }
    c.strokeStyle = "#9aabb0"; c.beginPath(); c.moveTo(L, T); c.lineTo(L, H - B); c.lineTo(W - R, H - B); c.stroke();
    c.fillStyle = "#26393b"; c.font = "bold 11px Pretendard, sans-serif";
    c.fillText(o.yLabel || "", L + 4, T + 2); c.textAlign = "right"; c.fillText(o.xLabel || "", W - R, H - 4); c.textAlign = "left";
    (o.marks || []).forEach(function (m) { c.strokeStyle = m.color || "#999"; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(L, Y(m.y)); c.lineTo(W - R, Y(m.y)); c.stroke(); c.setLineDash([]); c.fillStyle = m.color || "#999"; c.fillText(m.text || "", W - R - 120, Y(m.y) - 5); });
    if (o.vline != null) { c.strokeStyle = "#c9a227"; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(o.vline), T); c.lineTo(X(o.vline), H - B); c.stroke(); c.setLineDash([]); }
    (o.series || []).forEach(function (s) {
      if (!s.pts.length) return;
      c.strokeStyle = s.color; c.lineWidth = s.width || 2.5; c.beginPath();
      s.pts.forEach(function (p, i) { var px = X(p[0]), py = Y(p[1]); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.stroke();
      if (s.dots) s.pts.forEach(function (p) { c.fillStyle = s.color; c.beginPath(); c.arc(X(p[0]), Y(p[1]), 3.2, 0, 7); c.fill(); });
      var last = s.pts[s.pts.length - 1];
      if (s.label) { c.fillStyle = s.color; c.font = "bold 12px Pretendard, sans-serif"; c.fillText(s.label, Math.min(X(last[0]) + 6, W - R - 70), Y(last[1]) - 6 + (s.labelDy || 0)); }
    });
    return { X: X, Y: Y };
  };

  // 열화상 색 (0 차가움 → 1 뜨거움)
  LB.heat = function (t) {
    t = Math.max(0, Math.min(1, t));
    var stops = [[0, [20, 10, 80]], [0.25, [70, 20, 160]], [0.45, [200, 30, 120]], [0.65, [240, 90, 30]], [0.85, [255, 200, 40]], [1, [255, 255, 220]]];
    for (var i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      var a = stops[i - 1], b = stops[i], k = (t - a[0]) / (b[0] - a[0]);
      return "rgb(" + [0, 1, 2].map(function (j) { return Math.round(a[1][j] + (b[1][j] - a[1][j]) * k); }).join(",") + ")";
    }
    return "rgb(255,255,220)";
  };

  LB.three = function (el, h) {
    if (!window.THREE) return null;
    try {
      var r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      var w = el.clientWidth || 600; r.setSize(w, h); el.appendChild(r.domElement);
      var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      var d = new THREE.DirectionalLight(0xffffff, 0.75); d.position.set(4, 8, 6); scene.add(d);
      window.addEventListener("resize", function () { var ww = el.clientWidth || w; r.setSize(ww, h); cam.aspect = ww / h; cam.updateProjectionMatrix(); });
      return { r: r, scene: scene, cam: cam };
    } catch (e) { return null; }
  };

  LB.orbit = function (cam, dom, target, opt) {
    opt = opt || {};
    var st = { th: opt.th != null ? opt.th : 0.6, ph: opt.ph != null ? opt.ph : 1.05, R: opt.R || 9 }, drag = null;
    function upd() { cam.position.set(target.x + st.R * Math.sin(st.ph) * Math.sin(st.th), target.y + st.R * Math.cos(st.ph), target.z + st.R * Math.sin(st.ph) * Math.cos(st.th)); cam.lookAt(target); }
    dom.addEventListener("pointerdown", function (e) { drag = [e.clientX, e.clientY]; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener("pointermove", function (e) { if (!drag) return; st.th -= (e.clientX - drag[0]) * 0.008; st.ph = Math.max(0.25, Math.min(1.5, st.ph - (e.clientY - drag[1]) * 0.006)); drag = [e.clientX, e.clientY]; upd(); });
    dom.addEventListener("pointerup", function () { drag = null; });
    dom.addEventListener("wheel", function (e) { e.preventDefault(); st.R = Math.max(opt.min || 4, Math.min(opt.max || 20, st.R * (e.deltaY > 0 ? 1.08 : 0.92))); upd(); }, { passive: false });
    upd(); return { update: upd, st: st };
  };

  // 화면에 보일 때만 그리기
  LB.loop = function (el, fn) {
    var vis = true, last = performance.now();
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(el);
    function f(t) { var dt = Math.min(0.05, (t - last) / 1000); last = t; if (vis) fn(dt, t); requestAnimationFrame(f); }
    requestAnimationFrame(f);
  };
})();
