/* 중1 Ⅵ. 기체의 성질 — 기체 입자 모형 그리기 공통 (../g1-3/livebook.js 다음에 불러옴)
   GAS.box(n, speed)            : 입자 n개 (위치는 용기 안쪽을 0~1로 나타냄)
   GAS.drawSyringe(c, o)        : 가로 주사기. o = { x, y, w(기체가 차지한 길이), h, full(주사기 전체 길이), gas, dt, speed, plunger, cap }
   GAS.drawCylinder(c, o)       : 세운 실린더와 피스톤. o = { cx, bottom, w, maxH, hFrac(0~1), gas, dt, speed, weights }
   두 함수 모두 최근 1초 동안 입자가 벽에 부딪친 횟수를 돌려준다.
   입자는 화면에서 같은 빠르기(px/초)로 움직이므로, 용기가 좁아지면 벽에 더 자주 부딪친다. */
(function () {
  var GAS = window.GAS = {};
  GAS.box = function (n, speed) {
    var ps = [];
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283; ps.push({ x: 0.08 + Math.random() * 0.84, y: 0.08 + Math.random() * 0.84, vx: Math.cos(a), vy: Math.sin(a), f: 0 }); }
    return { ps: ps, speed: speed || 1, hits: [] };
  };
  // 용기 안쪽 (px) 사각형에서 입자를 움직이고 그린다
  function run(c, g, X, Y, W, H, dt, speed, col) {
    var now = performance.now() / 1000, hit = 0, v = 95 * (speed != null ? speed : g.speed), r = 5;
    g.ps.forEach(function (p) {
      var px = X + p.x * W, py = Y + p.y * H;
      px += p.vx * v * dt; py += p.vy * v * dt;
      if (px < X + r) { px = X + r; if (p.vx < 0) { p.vx = -p.vx; hit++; p.f = 1; } }
      if (px > X + W - r) { px = X + W - r; if (p.vx > 0) { p.vx = -p.vx; hit++; p.f = 1; } }
      if (py < Y + r) { py = Y + r; if (p.vy < 0) { p.vy = -p.vy; hit++; p.f = 1; } }
      if (py > Y + H - r) { py = Y + H - r; if (p.vy > 0) { p.vy = -p.vy; hit++; p.f = 1; } }
      p.x = W > 2 * r ? (px - X) / W : 0.5; p.y = H > 2 * r ? (py - Y) / H : 0.5;
      p.f = Math.max(0, p.f - dt * 4);
      var tail = Math.min(18, v * 0.12);
      c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px, py); c.lineTo(px - p.vx * tail, py - p.vy * tail); c.stroke();
      c.fillStyle = p.f > 0.25 ? "#ffe066" : (col || "#e0503a"); c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    });
    g.hits.push([now, hit]); while (g.hits.length && now - g.hits[0][0] > 1) g.hits.shift();
    return g.hits.reduce(function (s, x) { return s + x[1]; }, 0);
  }
  GAS.drawSyringe = function (c, o) {
    var x = o.x, y = o.y, h = o.h, full = o.full, w = Math.max(14, Math.min(full, o.w));
    // 몸통
    c.fillStyle = "rgba(190,225,255,.10)"; c.fillRect(x, y, full, h);
    c.strokeStyle = "rgba(190,225,255,.85)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x + full + 10, y); c.lineTo(x, y); c.lineTo(x, y + h * 0.35); c.moveTo(x, y + h * 0.65); c.lineTo(x, y + h); c.lineTo(x + full + 10, y + h); c.stroke();
    // 입구(마개)
    c.fillStyle = o.cap ? "#8a96a3" : "rgba(190,225,255,.85)"; c.fillRect(x - 16, y + h * 0.35, 16, h * 0.3);
    // 눈금
    c.strokeStyle = "rgba(190,225,255,.5)"; c.lineWidth = 1; for (var i = 0; i <= 6; i++) { var gx = x + full * i / 6; c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + 8); c.stroke(); }
    c.fillStyle = "rgba(190,225,255,.7)"; c.font = "10px Pretendard, sans-serif"; for (i = 1; i <= 6; i++) c.fillText(String(i * 10), x + full * i / 6 - 6, y - 4);
    c.fillStyle = "rgba(120,180,255,.10)"; c.fillRect(x, y, w, h);
    var hits = run(c, o.gas, x + 2, y + 2, w - 6, h - 4, o.dt, o.speed);
    // 피스톤
    c.fillStyle = "#b9c3d6"; c.fillRect(x + w - 4, y + 2, 12, h - 4);
    if (o.plunger !== false) { var rod = full * 0.35; c.fillStyle = "rgba(185,195,214,.55)"; c.fillRect(x + w + 8, y + h * 0.4, rod, h * 0.2); c.fillStyle = "#b9c3d6"; c.fillRect(x + w + 8 + rod, y + h * 0.05, 8, h * 0.9); }
    return hits;
  };
  GAS.drawCylinder = function (c, o) {
    var w = o.w, cx = o.cx, b = o.bottom, H = Math.max(24, o.maxH * o.hFrac), x = cx - w / 2;
    c.fillStyle = "#8a6a3a"; c.beginPath(); c.ellipse(cx, b + 6, w * 0.75, 10, 0, 0, 7); c.fill();
    c.fillStyle = "rgba(190,225,255,.10)"; c.fillRect(x, b - o.maxH - 20, w, o.maxH + 20);
    c.strokeStyle = "rgba(190,225,255,.8)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x, b - o.maxH - 20); c.lineTo(x, b); c.lineTo(x + w, b); c.lineTo(x + w, b - o.maxH - 20); c.stroke();
    c.fillStyle = "rgba(120,180,255,.10)"; c.fillRect(x, b - H, w, H);
    var hits = run(c, o.gas, x + 2, b - H + 2, w - 4, H - 4, o.dt, o.speed);
    c.fillStyle = "#9aa3ad"; c.fillRect(x + 1, b - H - 10, w - 2, 10);
    for (var k = 0; k < (o.weights || 0); k++) {
      var wx = cx - 46 + (k % 3) * 34, wy = b - H - 10 - 26 - Math.floor(k / 3) * 28;
      c.fillStyle = "#b8872f"; c.fillRect(wx, wy, 26, 26); c.fillStyle = "#d9a843"; c.fillRect(wx + 3, wy + 3, 20, 6); c.fillStyle = "#8a6420"; c.fillRect(wx + 9, wy - 6, 8, 6);
    }
    return hits;
  };
})();
