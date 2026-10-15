// 第1章「直線便」：v-t グラフで走る台車の運動
// グラフは折れ線（点 {t, v} の並び）。点と点の間は加速度が一定なので、
// 位置は等加速度運動の式で正確に計算できる（グラフの面積 ＝ 移動距離）。
window.PB = window.PB || {};

(function () {
  // 1秒ごとの速さ nodes[0..T] から折れ線を作る
  function fromNodes(nodes) {
    return nodes.map(function (v, i) { return { t: i, v: v }; });
  }
  // 設計の段階：加速度 a で速さ v まで加速 → t2 秒だけ等速 → 加速度 a で減速して止まる
  function trapezoid(a, v, t2) {
    var t1 = v / a;
    return [{ t: 0, v: 0 }, { t: t1, v: v }, { t: t1 + t2, v: v }, { t: 2 * t1 + t2, v: 0 }];
  }

  // 折れ線を調べる：各点での位置、最大の加速度、止まった場所の一覧、到着の時刻など
  function build(pts) {
    var X = [0], maxA = 0, sumDv = 0, stops = [], endT = pts[pts.length - 1].t;
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i], dt = q.t - p.t;
      X.push(X[i - 1] + (p.v + q.v) / 2 * dt);          // 台形の面積 ＝ 移動距離
      if (dt > 0) maxA = Math.max(maxA, Math.abs((q.v - p.v) / dt));
      sumDv += Math.abs(q.v - p.v);
      // 止まった瞬間：速さが 0 になる点、または向きが変わる点
      if (q.v === 0 && p.v !== 0) stops.push({ t: q.t, x: X[i] });
      else if (p.v * q.v < 0) {
        var tc = p.v / (p.v - q.v) * dt;
        stops.push({ t: p.t + tc, x: X[i - 1] + p.v * tc / 2 });
      }
    }
    var endV = pts[pts.length - 1].v, arrival = null;
    if (endV === 0) {   // 最後に止まった時刻（そのあとずっと 0 のまま）
      arrival = 0;
      for (var k = pts.length - 1; k > 0; k--) if (pts[k - 1].v !== 0) { arrival = pts[k].t; break; }
    }
    return { pts: pts, X: X, maxA: maxA, sumDv: sumDv, stops: stops, endT: endT, endX: X[X.length - 1], endV: endV, arrival: arrival };
  }

  // 時刻 t での位置・速さ・加速度
  function at(info, t) {
    var pts = info.pts;
    if (t <= 0) return { x: 0, v: pts[0].v, a: pts.length > 1 ? (pts[1].v - pts[0].v) / (pts[1].t - pts[0].t || 1) : 0 };
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i];
      if (t <= q.t || i === pts.length - 1) {
        var dt = q.t - p.t, a = dt > 0 ? (q.v - p.v) / dt : 0, tau = Math.min(t, q.t) - p.t;
        return { x: info.X[i - 1] + p.v * tau + 0.5 * a * tau * tau, v: p.v + a * tau, a: a };
      }
    }
    return { x: info.endX, v: info.endV, a: 0 };
  }

  // 届け先に順に止まれたか。targets は止まるべき位置の並び（最後が終点）。
  function judge(info, stage) {
    var tol = stage.tol, targets = stage.targets, si = 0, k;
    if (info.maxA > stage.aMax + 1e-9) return { ok: false, why: 'accel' };
    for (k = 0; k < targets.length - 1; k++) {   // 途中の届け先
      var found = false;
      for (; si < info.stops.length; si++) {
        if (Math.abs(info.stops[si].x - targets[k]) <= tol) { found = true; si++; break; }
      }
      if (!found) return { ok: false, why: 'via', target: targets[k] };
    }
    var last = targets[targets.length - 1], d = info.endX - last;
    if (info.endV !== 0) return { ok: false, why: 'moving', d: d };
    if (Math.abs(d) > tol) return { ok: false, why: d > 0 ? 'over' : 'short', d: Math.abs(d) };
    return { ok: true, d: Math.abs(d) };
  }

  PB.line = { fromNodes: fromNodes, trapezoid: trapezoid, build: build, at: at, judge: judge };
})();
