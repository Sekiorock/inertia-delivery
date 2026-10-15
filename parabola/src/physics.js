// 放物運動の計算、着地の判定、給料（重力だけが働く。空気抵抗なし）
// 位置は等加速度運動の式でそのまま計算するので、計算の誤差は出ない。
// 着地の瞬間も、二次方程式を解いて正確に求める（公式の飛距離と一致する）。
window.PB = window.PB || {};

(function () {
  var GROUND = { x: -1000, y: -50, w: 3000, h: 50 };   // 地面（y = 0 が地表）

  function createState(stage) {
    return {
      x: stage.launch.x, y: stage.launch.y, vx: 0, vy: 0,
      t: 0, flying: false, done: false,
      result: null,          // 'hit' | 'wall' | 'land' | 'out'
      maxY: stage.launch.y,
      trail: [], nextStrobe: 0,
      v0: 0, theta: 0
    };
  }

  function launch(st, stage, v0, thetaDeg) {
    var th = thetaDeg * Math.PI / 180;
    st.x = stage.launch.x; st.y = stage.launch.y;
    st.vx = v0 * Math.cos(th); st.vy = v0 * Math.sin(th);
    st.t = 0; st.flying = true; st.done = false; st.result = null;
    st.maxY = st.y; st.trail = [{ x: st.x, y: st.y }]; st.nextStrobe = stage.strobe;
    st.v0 = v0; st.theta = thetaDeg;
  }

  // dt 秒のあいだに、どこかの面に最初にぶつかる時刻を探す
  function firstContact(x0, y0, vx, vy, g, dt, stage) {
    var best = null;
    var rects = stage.rects.concat([GROUND]);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i], top = r.y + r.h, rx0 = r.x, rx1 = r.x + r.w;
      // 上の面：上から下へ横切る
      if (y0 >= top) {
        var tau = -1;
        if (g > 0) {
          var disc = vy * vy + 2 * g * (y0 - top);
          tau = (vy + Math.sqrt(disc)) / g;
        } else if (vy < 0) {
          tau = (y0 - top) / -vy;
        }
        if (tau >= 0 && tau <= dt) {
          var xc = x0 + vx * tau;
          if (xc >= rx0 && xc <= rx1 && (!best || tau < best.tau)) best = { tau: tau, x: xc, y: top, rect: r, face: 'top' };
        }
      }
      // 横の面：左の面（右向きに進むとき）と右の面（左向きに進むとき）
      var faces = [];
      if (vx > 0 && x0 <= rx0) faces.push(rx0);
      if (vx < 0 && x0 >= rx1) faces.push(rx1);
      for (var k = 0; k < faces.length; k++) {
        var ts = (faces[k] - x0) / vx;
        if (ts >= 0 && ts <= dt) {
          var yc = y0 + vy * ts - 0.5 * g * ts * ts;
          if (yc >= r.y && yc < top && (!best || ts < best.tau)) best = { tau: ts, x: faces[k], y: yc, rect: r, face: 'side' };
        }
      }
    }
    return best;
  }

  function step(st, stage, g, dt) {
    if (!st.flying) return;
    var c = firstContact(st.x, st.y, st.vx, st.vy, g, dt, stage);
    var h = c ? c.tau : dt;
    // 最高点（この間に上向きの速度が0を通るとき）
    if (st.vy > 0 && st.vy - g * h <= 0 && g > 0) st.maxY = Math.max(st.maxY, st.y + st.vy * st.vy / (2 * g));
    var nx = st.x + st.vx * h, ny = st.y + st.vy * h - 0.5 * g * h * h;
    // 等しい時間ごとの点（ストロボ）
    while (st.nextStrobe <= st.t + h + 1e-9) {
      var ts = st.nextStrobe - st.t;
      st.trail.push({ x: st.x + st.vx * ts, y: st.y + st.vy * ts - 0.5 * g * ts * ts });
      st.nextStrobe += stage.strobe;
    }
    st.x = nx; st.y = ny; st.vy -= g * h; st.t += h;
    st.maxY = Math.max(st.maxY, st.y);
    if (c) {
      st.flying = false; st.done = true;
      var b = stage.basket;
      var inBasket = c.face === 'top' && Math.abs(c.y - b.y) < 1e-6 && Math.abs(c.x - b.x) <= b.w / 2;
      st.result = inBasket ? 'hit' : (c.face === 'side' ? 'wall' : 'land');
      return;
    }
    if (st.x < -5 || st.x > stage.width + 5 || st.t > 120) {
      st.flying = false; st.done = true; st.result = 'out';
    }
  }

  // 投げる前に、そのまま投げたらどう飛ぶかを計算する（予測線用。本番と同じ計算）
  function predict(stage, g, v0, thetaDeg, dt) {
    var st = createState(stage);
    launch(st, stage, v0, thetaDeg);
    var pts = [{ x: st.x, y: st.y }], n = 0;
    while (st.flying && n < 4000) { step(st, stage, g, dt); pts.push({ x: st.x, y: st.y }); n++; }
    return { points: pts, x: st.x, y: st.y, t: st.t, maxY: st.maxY, result: st.result };
  }

  // 給料：手取り = 基本給 + 精度ボーナス + 予測ボーナス − エネルギー代
  // カゴの中心に届く投げ方のうち、打ち出しのエネルギーが最小のもの（設計の段階の効率ボーナス用）
  // 角度ごとに、カゴの中心を通る速さを公式 v² = g x² / (2 cos²θ (x tanθ − h)) で求め、障害物に当たらないか確かめる。
  function minEnergy(stage, g, cfg) {
    var x = stage.basket.x - stage.launch.x, h = stage.basket.y - stage.launch.y, best = null;
    for (var th = 0.25; th < 90; th += 0.25) {
      var r = th * Math.PI / 180, c = Math.cos(r), den = 2 * c * c * (x * Math.tan(r) - h);
      if (den <= 0) continue;
      var v = Math.sqrt(g * x * x / den);
      if (v > cfg.vMax || (best && v >= best.v)) continue;
      var p = predict(stage, g, v, th, 1 / 240);
      if (p.result === 'hit') best = { v: v, theta: th };
    }
    if (best) best.energy = 0.5 * cfg.parcelMass * best.v * best.v;
    return best;
  }

  // extra = { quiz, estimate, design, efficiency }：段階ごとのボーナス [円]
  function calcPay(st, stage, cfg, mode, pinX, extra) {
    var b = stage.basket;
    var precision = Math.round(cfg.precisionBonusMax * Math.max(0, 1 - Math.abs(st.x - b.x) / (b.w / 2)));
    var predict = 0, err = null;
    if (mode === 'predict' && pinX != null) {
      err = Math.abs(pinX - st.x);
      predict = Math.round(cfg.predictBonusMax * Math.max(0, 1 - err / stage.predictTol));
    }
    var energy = 0.5 * cfg.parcelMass * st.v0 * st.v0;     // 打ち出しのエネルギー ½mv₀² [J]
    var cost = Math.round(energy * cfg.energyPrice);
    extra = extra || {};
    var quiz = extra.quiz || 0, est = extra.estimate || 0, des = extra.design || 0, eff = extra.efficiency || 0;
    var gross = stage.basePay + precision + predict + quiz + est + des + eff;
    var net = gross - cost;
    var stars = net >= stage.basePay * cfg.star3Ratio ? 3 : (net >= stage.basePay * cfg.star2Ratio ? 2 : 1);
    return { base: stage.basePay, precision: precision, predict: predict, quiz: quiz, estimate: est, design: des, efficiency: eff, err: err,
             energy: energy, cost: cost, gross: gross, net: net, stars: stars };
  }

  PB.physics = { createState: createState, launch: launch, step: step, predict: predict, calcPay: calcPay, minEnergy: minEnergy };
})();
