// ステージ・機体・炎・矢印・数値の描画
// 段階4：しずかとたけしのデザイン、炎の粒子、ドッキングの効果、画面の揺れ
window.ID = window.ID || {};

(function () {
  var canvas, ctx, cfg, T, W = 0, H = 0, dpr = 1;
  var el = {}, hudBottom = 0, hudDirty = true;
  var particles = [];          // 炎の粒子（見た目だけ。物理の計算には関係しない）
  var emitRest = 0;
  var FONT = '-apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';

  function init(canvasEl, config, texts) {
    canvas = canvasEl; ctx = canvas.getContext('2d'); cfg = config; T = texts;
    ['speed', 'accel', 'thrust', 'time', 'fuel', 'cost'].forEach(function (k) {
      document.getElementById('lbl-' + k).textContent = T.hud[k];
      el[k] = document.getElementById('val-' + k);
    });
    el.remain = document.getElementById('remain');
    document.getElementById('version').textContent = 'v' + cfg.version;
    resize();
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    hudDirty = true;   // 数値の欄の高さは、次の描画のあとで測り直す
  }

  function reset() { particles.length = 0; emitRest = 0; }

  function navy(a) { return 'rgba(27,42,73,' + a + ')'; }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  // ---------- 機体の絵（デフォルメした小型のメカ） ----------
  // (cx, cy) が中心、u が機体の一辺の長さ [px]。座標は u を 1 とした割合で書く。
  function drawShip(c, id, cx, cy, u) {
    var NV = cfg.colors.navy, WH = cfg.colors.white;
    c.save();
    c.translate(cx, cy);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.lineWidth = Math.max(1.5, u * 0.035);
    c.strokeStyle = NV;
    function box(x, y, w, h, r, fill) { roundRect(c, x * u, y * u, w * u, h * u, r * u); c.fillStyle = fill; c.fill(); c.stroke(); }
    function circle(x, y, r, fill, stroke) { c.beginPath(); c.arc(x * u, y * u, r * u, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke !== false) c.stroke(); }

    if (id === 'takeshi') {
      // たけし：肩幅の広い装甲と太いアーム。頑丈で強い印象
      var base = '#C49A3A', dark = '#9A7626', light = '#DDBB66';
      box(-0.30, 0.26, 0.22, 0.24, 0.05, dark);            // 脚
      box(0.08, 0.26, 0.22, 0.24, 0.05, dark);
      box(-0.50, -0.10, 0.17, 0.46, 0.07, dark);           // 太いアーム
      box(0.33, -0.10, 0.17, 0.46, 0.07, dark);
      box(-0.13, -0.48, 0.26, 0.20, 0.06, dark);           // 頭
      box(-0.31, -0.32, 0.62, 0.64, 0.09, base);           // 胴体
      box(-0.50, -0.38, 0.27, 0.30, 0.08, light);          // 肩の装甲
      box(0.23, -0.38, 0.27, 0.30, 0.08, light);
      box(-0.17, -0.20, 0.34, 0.11, 0.05, WH);             // バイザー
      c.fillStyle = NV; roundRect(c, -0.11 * u, -0.17 * u, 0.22 * u, 0.05 * u, 0.02 * u); c.fill();
      c.beginPath();                                        // 胸のパネル
      c.moveTo(-0.17 * u, 0.04 * u); c.lineTo(0.17 * u, 0.04 * u);
      c.moveTo(-0.17 * u, 0.16 * u); c.lineTo(0.17 * u, 0.16 * u);
      c.stroke();
    } else {
      // しずか：細身の機体。華奢でかわいらしい印象
      var pink = '#F29BB8', pdark = '#D9779A', plight = '#FBD3DF';
      c.beginPath();                                        // アンテナ
      c.moveTo(-0.07 * u, -0.38 * u); c.lineTo(-0.17 * u, -0.48 * u);
      c.moveTo(0.07 * u, -0.38 * u); c.lineTo(0.17 * u, -0.48 * u);
      c.stroke();
      circle(-0.17, -0.48, 0.03, pdark);
      circle(0.17, -0.48, 0.03, pdark);
      box(-0.33, 0.00, 0.11, 0.30, 0.05, pdark);           // 左右の小さな噴射口
      box(0.22, 0.00, 0.11, 0.30, 0.05, pdark);
      box(-0.13, 0.36, 0.09, 0.13, 0.03, pdark);           // 足
      box(0.04, 0.36, 0.09, 0.13, 0.03, pdark);
      box(-0.20, -0.42, 0.40, 0.84, 0.20, pink);           // 細い胴体
      c.beginPath(); c.ellipse(0, 0.17 * u, 0.11 * u, 0.15 * u, 0, 0, Math.PI * 2);
      c.fillStyle = plight; c.fill();                       // おなかのパネル
      circle(0, -0.17, 0.12, WH);                           // 丸いレンズ
      circle(0, -0.17, 0.055, NV, false);
      circle(0.02, -0.19, 0.018, WH, false);
    }
    c.restore();
  }

  // 矢印。filled=true は塗りつぶし（速度）、false は線のみ（加速度）
  function arrow(x1, y1, x2, y2, filled, color) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 3) return;
    var ux = dx / len, uy = dy / len;
    var head = Math.min(12, len * 0.6), half = head * 0.55;
    var bx = x2 - ux * head, by = y2 - uy * head;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    ctx.lineWidth = filled ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(bx - uy * half, by + ux * half);
    ctx.lineTo(bx + uy * half, by - ux * half);
    ctx.closePath();
    if (filled) { ctx.fill(); }
    else { ctx.lineWidth = 2; ctx.fillStyle = cfg.colors.white; ctx.fill(); ctx.stroke(); }
  }

  function clampLen(v) { return v > cfg.arrowMaxLength ? cfg.arrowMaxLength : v; }

  // 炎の粒子を出す。出力が大きいほど量と長さが増える
  function emit(st, ship, dt) {
    if (st.thrust <= 0) { emitRest = 0; return; }
    var ratio = st.thrust / ship.maxThrust;
    emitRest += (40 + 160 * ratio) * dt;
    var half = ship.size / 2;
    while (emitRest >= 1) {
      emitRest -= 1;
      if (particles.length > 400) particles.shift();
      var sp = (5 + 9 * ratio) * (0.7 + Math.random() * 0.6);      // 噴き出す速さ [m/s]
      var ang = (Math.random() - 0.5) * 0.5;                       // 広がり
      var c = Math.cos(ang), s = Math.sin(ang);
      var ex = -(st.thrustDirX * c - st.thrustDirY * s), ey = -(st.thrustDirX * s + st.thrustDirY * c);
      var life = (0.18 + 0.32 * ratio) * (0.6 + Math.random() * 0.8);
      particles.push({
        x: st.x - st.thrustDirX * half * 0.8 + (Math.random() - 0.5) * half * 0.6,
        y: st.y - st.thrustDirY * half * 0.8 + (Math.random() - 0.5) * half * 0.6,
        vx: st.vx + ex * sp, vy: st.vy + ey * sp,
        age: 0, life: life, r: (0.10 + 0.14 * ratio) * (0.6 + Math.random() * 0.8)
      });
    }
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  // fx = { dt: 前のコマからの時間 [s], dock: ドッキングの効果の進み具合（0〜1、なければ -1） }
  function draw(st, stage, ship, inp, cmd, fx) {
    var P = ID.physics;
    fx = fx || { dt: 0, dock: -1 };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cfg.colors.white; ctx.fillRect(0, 0, W, H);

    var stageH = H * (1 - cfg.controlAreaRatio);   // ステージ表示の高さ [px]

    // 受け取り口に近づくほどズームし、受け取り口を画面の中央に寄せる
    var d = P.dockPosition(stage, st.t);
    var dist = Math.hypot(st.x - d.x, st.y - d.y);
    var zt = (cfg.zoomStartDist - dist) / (cfg.zoomStartDist - cfg.zoomFullDist);
    zt = zt < 0 ? 0 : (zt > 1 ? 1 : zt);
    var zoom = 1 + (cfg.zoomMax - 1) * zt;

    var s = W / cfg.worldWidth * zoom;             // 1 m あたりの px
    var viewW = W / s, viewM = stageH / s;         // 見えている幅と高さ [m]

    // 遠いとき：機体を下から30%の位置に置き、上へ進む先を広く見せる
    var cx = cfg.worldWidth / 2;
    var cy = st.y + viewM * 0.2;
    var cyMin = -3 + viewM / 2, cyMax = stage.height + 5 - viewM / 2;
    if (cy > cyMax) cy = cyMax;
    if (cy < cyMin) cy = cyMin;
    // 近いとき：受け取り口を中央へ
    cx += (d.x - cx) * zt;
    cy += (d.y - cy) * zt;
    // 機体が画面の外に出ないようにする
    var rx = viewW / 2 - viewW * 0.12 * zt, ry = viewM / 2 - viewM * 0.12;
    if (cx < st.x - rx) cx = st.x - rx;
    if (cx > st.x + rx) cx = st.x + rx;
    if (cy < st.y - ry) cy = st.y - ry;
    if (cy > st.y + ry) cy = st.y + ry;

    // 大型機の最大出力では、画面がわずかに揺れる
    var shx = 0, shy = 0;
    if (ship.steps && st.thrust >= ship.maxThrust * 0.99) {
      shx = (Math.random() - 0.5) * cfg.shakePx * 2; shy = (Math.random() - 0.5) * cfg.shakePx * 2;
    }

    // ズーム中は、上の数値に隠れない範囲の中央に受け取り口が来るようにする
    var midY = stageH / 2 + hudBottom / 2 * zt;
    function sx(x) { return W / 2 + (x - cx) * s + shx; }
    function sy(y) { return midY - (y - cy) * s + shy; }

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, stageH); ctx.clip();

    // グリッド。動いて見えることで速さが分かる
    var x0 = cx - viewW / 2, x1 = cx + viewW / 2, y0 = cy - viewM, y1 = cy + viewM;
    function grid(stepM, alpha) {
      ctx.strokeStyle = navy(alpha); ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = Math.floor(x0 / stepM) * stepM; gx <= x1; gx += stepM) { ctx.moveTo(sx(gx), 0); ctx.lineTo(sx(gx), stageH); }
      for (var gy = Math.floor(y0 / stepM) * stepM; gy <= y1; gy += stepM) { ctx.moveTo(0, sy(gy)); ctx.lineTo(W, sy(gy)); }
      ctx.stroke();
    }
    if (zt > 0.3) grid(1, 0.07 * (zt - 0.3) / 0.7);   // ズーム中は 1 m ごとの細かい線
    grid(5, 0.12);                                    // 5 m ごと

    // 通路の壁
    ctx.fillStyle = navy(0.4);
    stage.walls.forEach(function (w) {
      ctx.fillRect(sx(w.x), sy(w.y + w.h), w.w * s, w.h * s);
    });

    // 受け取り口
    var dx = sx(d.x), dy = sy(d.y), dr = stage.dock.radius * s;
    var k = fx.dock;   // ドッキングの効果（0〜1）
    ctx.fillStyle = navy(k >= 0 ? 0.15 + 0.2 * Math.min(1, k * 3) : 0.15);
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = cfg.colors.navy; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dx - 5, dy); ctx.lineTo(dx + 5, dy); ctx.moveTo(dx, dy - 5); ctx.lineTo(dx, dy + 5); ctx.stroke();
    if (k < 0 && st.hold > 0) {   // 止まっている時間の進み具合
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(dx, dy, dr + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, st.hold / cfg.dockHoldTime));
      ctx.stroke();
    }
    if (k >= 0) {
      // 外側の輪が「カチッ」と閉じる
      var c1 = Math.min(1, k / 0.25), ease = 1 - Math.pow(1 - c1, 3);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(dx, dy, dr + 6 + (1 - ease) * dr * 0.9, 0, Math.PI * 2); ctx.stroke();
      // 閉じた瞬間に広がる輪
      if (k > 0.25) {
        var c2 = (k - 0.25) / 0.75;
        ctx.strokeStyle = navy(0.5 * (1 - c2)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(dx, dy, dr + 6 + c2 * dr * 1.5, 0, Math.PI * 2); ctx.stroke();
        // 4か所の留め具
        ctx.strokeStyle = cfg.colors.navy; ctx.lineWidth = 5; ctx.lineCap = 'butt';
        ctx.beginPath();
        for (var q = 0; q < 4; q++) {
          var qa = Math.PI / 4 + q * Math.PI / 2;
          ctx.moveTo(dx + Math.cos(qa) * (dr - 2), dy + Math.sin(qa) * (dr - 2));
          ctx.lineTo(dx + Math.cos(qa) * (dr + 14), dy + Math.sin(qa) * (dr + 14));
        }
        ctx.stroke();
      }
    }
    // 受け取り口が画面の上に隠れているときの目印
    if (dy < hudBottom) {
      ctx.fillStyle = cfg.colors.navy;
      var my = hudBottom + 6;
      ctx.beginPath(); ctx.moveTo(dx, my); ctx.lineTo(dx - 8, my + 12); ctx.lineTo(dx + 8, my + 12); ctx.closePath(); ctx.fill();
    }

    // 炎の粒子（噴射の反対側に出る）
    emit(st, ship, fx.dt);
    updateParticles(fx.dt);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], life = 1 - p.age / p.life;
      ctx.fillStyle = navy(0.55 * life);
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), Math.max(1, p.r * s * (0.5 + 0.5 * life)), 0, Math.PI * 2); ctx.fill();
    }

    // 機体
    var px = sx(st.x), py = sy(st.y);
    drawShip(ctx, ship.id, px, py, ship.size * s);

    // 速度の矢印（塗りつぶし）
    var v = Math.hypot(st.vx, st.vy);
    if (v > 0.01 && k < 0) {
      var vl = clampLen(v * cfg.velArrowScale) * s;
      arrow(px, py, px + st.vx / v * vl, py - st.vy / v * vl, true, cfg.colors.navy);
    }
    // 加速度の矢印（線のみ）
    var a = Math.hypot(st.ax, st.ay);
    if (a > 0) {
      var al = clampLen(a * cfg.accArrowScale) * s;
      arrow(px, py, px + st.ax / a * al, py - st.ay / a * al, false, cfg.colors.navy);
    }

    // 「配達完了」の表示
    if (k >= 0) {
      var tw = 190, th = 48, tx = W / 2 - tw / 2, ty = Math.max(hudBottom + 16, dy - dr - 90);
      var pop = Math.min(1, k / 0.2);
      ctx.globalAlpha = pop;
      roundRect(ctx, tx, ty, tw, th, 10); ctx.fillStyle = cfg.colors.navy; ctx.fill();
      ctx.fillStyle = cfg.colors.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 24px ' + FONT;
      ctx.fillText(T.success, W / 2, ty + th / 2 + 1);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 操作エリア
    ctx.fillStyle = navy(0.06); ctx.fillRect(0, stageH, W, H - stageH);
    ctx.strokeStyle = navy(0.4); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, stageH); ctx.lineTo(W, stageH); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!inp.active) {
      if (k < 0) {
        ctx.fillStyle = navy(0.6);
        ctx.font = '600 16px ' + FONT;
        ctx.fillText(T.controlHint, W / 2, stageH + (H - stageH) / 2 - 12);
        ctx.font = '12px ' + FONT;
        ctx.fillText(T.controlHint2, W / 2, stageH + (H - stageH) / 2 + 14);
      }
    } else {
      // 触れた点、あそびの円、最大出力の円
      ctx.strokeStyle = navy(0.4); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(inp.originX, inp.originY, cfg.deadZonePx, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = navy(0.2);
      ctx.beginPath(); ctx.arc(inp.originX, inp.originY, cfg.fullPowerPx, 0, Math.PI * 2); ctx.stroke();
      if (ship.steps) {   // 3段階の機体：段が切り替わる位置の円
        for (var n = 1; n < 3; n++) {
          var rr = cfg.deadZonePx + cfg.stepThresholds[n] * (cfg.fullPowerPx - cfg.deadZonePx);
          ctx.beginPath(); ctx.arc(inp.originX, inp.originY, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // 触れた点からの矢印（最大出力の円より先には伸びない）
      var ddx = inp.curX - inp.originX, ddy = inp.curY - inp.originY, dd = Math.hypot(ddx, ddy);
      var pct = 0;
      if (cmd.on) {
        var m = Math.min(dd, cfg.fullPowerPx);
        arrow(inp.originX, inp.originY, inp.originX + ddx / dd * m, inp.originY + ddy / dd * m, true, cfg.colors.navy);
        pct = Math.round(P.thrustFromLevel(cmd.level, ship) / ship.maxThrust * 100);
      }
      ctx.fillStyle = cfg.colors.navy;
      ctx.font = '700 18px ' + FONT;
      ctx.fillText(T.power + ' ' + pct + '%', W / 2, stageH + 22);   // 指や矢印に隠れない位置に出す
    }

    // 数値（SI単位）
    el.speed.textContent = v.toFixed(2) + ' m/s';
    el.accel.textContent = a > 0 ? a.toFixed(2) + ' m/s²' : T.none;
    el.thrust.textContent = st.thrust > 0 ? Math.round(st.thrust) + ' N' : T.none;
    el.time.textContent = st.t.toFixed(1) + ' s';
    el.fuel.textContent = st.fuel.toFixed(2) + ' kg';
    el.cost.textContent = Math.round(st.fuel * cfg.fuelPrice).toLocaleString('ja-JP') + '円';
    el.remain.textContent = T.remain + dist.toFixed(1) + ' m';
    if (hudDirty) {   // 数値が入った状態で、欄の下端の位置を測る
      hudBottom = document.getElementById('hud').getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
      hudDirty = false;
    }
  }

  ID.render = { init: init, resize: resize, reset: reset, draw: draw, drawShip: drawShip };
})();
