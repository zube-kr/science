/* 중1 Ⅳ. 물질의 상태 변화 공통 — 고체·액체·기체 입자 모형 (../g1-3/livebook.js 다음에 불러옴)
   phase: 0 = 고체, 1 = 액체, 2 = 기체 (사이 값은 상태가 변하는 중)
   MT.Particles2D(n)     : p.draw(c, x, y, w, h, phase, dt, color, {r, direct})  — 상자 안 입자 모형 그리기 (direct: 고체↔기체 승화)
   MT.Box3D(el, h, opt)  : three.js 상자 속 입자 3D (opt.n, opt.color) → { set(phase), box, scene, cam, r }
   MT.stateName(phase)   : "고체" / "액체" / "기체" / "고체 + 액체" … */
(function () {
  var MT = window.MT = {};
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  MT.stateName = function (ph) {
    if (ph < 0.08) return "고체";
    if (ph < 0.92) return "고체 + 액체";
    if (ph < 1.08) return "액체";
    if (ph < 1.92) return "액체 + 기체";
    return "기체";
  };

  // 입자마다 고체 자리(격자), 액체 자리(바닥에 모여 흐름), 기체 자리(상자 전체를 날아다님)를 갖고 phase에 따라 섞음
  MT.Particles2D = function (n) {
    var side = Math.ceil(Math.sqrt(n)), P = [];
    for (var i = 0; i < n; i++) P.push({
      gx: i % side, gy: Math.floor(i / side),
      lx: rnd(0.05, 0.95), ly: rnd(0, 1), lvx: rnd(-1, 1), lvy: rnd(-1, 1),
      x: rnd(0.05, 0.95), y: rnd(0.05, 0.95), vx: rnd(-1, 1), vy: rnd(-1, 1), ph: rnd(0, 6.28)
    });
    this.P = P; this.side = side; this.t = 0;
  };
  MT.Particles2D.prototype.draw = function (c, X, Y, W, H, phase, dt, color, opt) {
    opt = opt || {}; this.t += dt;
    var P = this.P, side = this.side, t = this.t, r = opt.r || Math.min(W, H) / (side * 2.6);
    var gap = r * 2.05, latW = gap * side, x0 = X + (W - latW) / 2 + r, yb = Y + H - r - 2;
    var liqH = Math.min(H - 2 * r, Math.max(gap * 1.5, P.length * Math.pow(gap * 1.25, 2) / (W - 2 * r))); // 액체: 그릇 바닥을 따라 퍼지되 촘촘함
    var a = clamp(phase, 0, 1), b = clamp(phase - 1, 0, 1), jig = 0.6 + 2.4 * clamp(phase, 0, 1.2);
    if (opt.direct) { a = 0; b = clamp(phase / 2, 0, 1); jig = 0.6 + 2 * b; } // 승화: 액체를 거치지 않음
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      // 액체: 바닥 쪽 영역에서 천천히 돌아다님
      p.lx += p.lvx * dt * 0.12; p.ly += p.lvy * dt * 0.12;
      if (p.lx < 0.04 || p.lx > 0.96) p.lvx *= -1; if (p.ly < 0 || p.ly > 1) p.lvy *= -1;
      if (Math.random() < dt * 0.8) { p.lvx = rnd(-1, 1); p.lvy = rnd(-1, 1); }
      // 기체: 빠르게 날아다니며 벽에 튕김
      var sp = 0.55; p.x += p.vx * dt * sp; p.y += p.vy * dt * sp;
      if (p.x < 0.03 || p.x > 0.97) { p.vx *= -1; p.x = clamp(p.x, 0.03, 0.97); }
      if (p.y < 0.03 || p.y > 0.97) { p.vy *= -1; p.y = clamp(p.y, 0.03, 0.97); }
      var sx = x0 + p.gx * gap, sy = yb - p.gy * gap;
      var lx = X + r + p.lx * (W - 2 * r), ly = yb - p.ly * liqH;
      var gx = X + r + p.x * (W - 2 * r), gy = Y + r + p.y * (H - 2 * r);
      var px = sx + (lx - sx) * a, py = sy + (ly - sy) * a;
      px += (gx - px) * b; py += (gy - py) * b;
      if (b < 0.5) { px += Math.sin(t * 9 + p.ph) * jig * 0.6; py += Math.cos(t * 11 + p.ph * 1.3) * jig * 0.6; }
      // 상태가 변하는 중에는 일부 입자만 먼저 바뀐 것처럼 보이게(입자마다 문턱이 다름)
      c.fillStyle = color || "#3d8bd9";
      c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    }
  };

  // 3D 상자 속 입자
  MT.Box3D = function (el, h, opt) {
    opt = opt || {};
    var T = LB.three(el, h); if (!T) return null;
    var n = opt.n || 64, side = Math.round(Math.cbrt(n)), r = 0.17, gap = 0.36;
    var scene = T.scene, cam = T.cam;
    var orb = LB.orbit(cam, T.r.domElement, new THREE.Vector3(0, 0, 0), { R: opt.R || 10.5, th: 0.6, ph: 1.15, min: 5, max: 16 });
    var box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial({ color: 0x9fd3ff, wireframe: true, transparent: true, opacity: 0.35 }));
    scene.add(box);
    var mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color: opt.color || 0x3d8bd9, roughness: 0.35 }), n);
    scene.add(mesh);
    var P = [], m = new THREE.Matrix4();
    for (var i = 0; i < n; i++) P.push({
      s: new THREE.Vector3((i % side - (side - 1) / 2) * gap, (Math.floor(i / side) % side) * gap - 2 + r + 0.02, (Math.floor(i / side / side) - (side - 1) / 2) * gap),
      l: new THREE.Vector3(rnd(-1.4, 1.4), rnd(-1.75, -0.3), rnd(-1.4, 1.4)), lv: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)),
      g: new THREE.Vector3(rnd(-1.7, 1.7), rnd(-1.7, 1.7), rnd(-1.7, 1.7)), gv: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(2.2), ph: rnd(0, 6.28)
    });
    var api = { phase: 0, box: box, scene: scene, cam: cam, r: T.r, orbit: orb, mesh: mesh, onFrame: null };
    api.set = function (ph) { api.phase = ph; };
    var t = 0, tmp = new THREE.Vector3();
    LB.loop(el, function (dt) {
      t += dt; var ph = api.phase, a = clamp(ph, 0, 1), b = clamp(ph - 1, 0, 1), jig = 0.02 + 0.06 * a;
      for (var i = 0; i < n; i++) {
        var p = P[i];
        p.l.addScaledVector(p.lv, dt * 0.35);
        ["x", "z"].forEach(function (k) { if (Math.abs(p.l[k]) > 1.5) p.lv[k] *= -1; });
        if (p.l.y < -1.75 || p.l.y > -0.3) p.lv.y *= -1;
        p.g.addScaledVector(p.gv, dt);
        ["x", "y", "z"].forEach(function (k) { if (Math.abs(p.g[k]) > 1.75) { p.gv[k] *= -1; p.g[k] = clamp(p.g[k], -1.75, 1.75); } });
        tmp.copy(p.s).lerp(p.l, a).lerp(p.g, b);
        if (b < 0.5) { tmp.x += Math.sin(t * 10 + p.ph) * jig; tmp.y += Math.cos(t * 12 + p.ph) * jig; tmp.z += Math.sin(t * 8 + p.ph * 2) * jig; }
        m.makeTranslation(tmp.x, tmp.y, tmp.z); mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (api.onFrame) api.onFrame(dt, t);
      T.r.render(scene, cam);
    });
    return api;
  };
})();
