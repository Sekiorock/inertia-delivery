// ステージ・機体・炎・矢印・数値の描画
// 段階1は四角形の機体と線だけ。見た目は段階4で仕上げる。
window.ID = window.ID || {};

(function () {
  var canvas, ctx, cfg, T, W = 0, H = 0, dpr = 1;
  var el = {}, hudBottom = 0, hudDirty = true;

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

  function navy(a) { return 'rgba(27,42,73,' + a + ')'; }

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

  function draw(st, stage, ship, inp, cmd) {
    var P = ID.physics;
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

    function sx(x) { return W / 2 + (x - cx) * s; }
    // ズーム中は、上の数値に隠れない範囲の中央に受け取り口が来るようにする
    var midY = stageH / 2 + hudBottom / 2 * zt;
    function sy(y) { return midY - (y - cy) * s; }

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
    ctx.fillStyle = navy(0.15);
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = cfg.colors.navy; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dx - 5, dy); ctx.lineTo(dx + 5, dy); ctx.moveTo(dx, dy - 5); ctx.lineTo(dx, dy + 5); ctx.stroke();
    if (st.hold > 0) {   // 止まっている時間の進み具合
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(dx, dy, dr + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, st.hold / cfg.dockHoldTime));
      ctx.stroke();
    }
    // 受け取り口が画面の上に隠れているときの目印
    if (dy < hudBottom) {
      ctx.fillStyle = cfg.colors.navy;
      var my = hudBottom + 6;
      ctx.beginPath(); ctx.moveTo(dx, my); ctx.lineTo(dx - 8, my + 12); ctx.lineTo(dx + 8, my + 12); ctx.closePath(); ctx.fill();
    }

    // 機体
    var px = sx(st.x), py = sy(st.y), half = ship.size * s / 2;

    // 炎（噴射の反対側に出る線）
    if (st.thrust > 0) {
      var fl = (0.8 + 2.2 * st.thrust / ship.maxThrust) * s;
      var fx = -st.thrustDirX, fy = st.thrustDirY;   // 画面は下が正
      ctx.strokeStyle = cfg.colors.navy; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (var i = -1; i <= 1; i++) {
        var ox = -fy * i * half * 0.5, oy = fx * i * half * 0.5;
        var k = i === 0 ? 1 : 0.6;
        ctx.moveTo(px + fx * half + ox, py + fy * half + oy);
        ctx.lineTo(px + fx * (half + fl * k) + ox, py + fy * (half + fl * k) + oy);
      }
      ctx.stroke();
    }

    ctx.fillStyle = ship.color; ctx.strokeStyle = cfg.colors.navy; ctx.lineWidth = 2;
    ctx.fillRect(px - half, py - half, half * 2, half * 2);
    ctx.strokeRect(px - half, py - half, half * 2, half * 2);

    // 速度の矢印（塗りつぶし）
    var v = Math.hypot(st.vx, st.vy);
    if (v > 0.01) {
      var vl = clampLen(v * cfg.velArrowScale) * s;
      arrow(px, py, px + st.vx / v * vl, py - st.vy / v * vl, true, cfg.colors.navy);
    }
    // 加速度の矢印（線のみ）
    var a = Math.hypot(st.ax, st.ay);
    if (a > 0) {
      var al = clampLen(a * cfg.accArrowScale) * s;
      arrow(px, py, px + st.ax / a * al, py - st.ay / a * al, false, cfg.colors.navy);
    }
    ctx.restore();

    // 操作エリア
    ctx.fillStyle = navy(0.06); ctx.fillRect(0, stageH, W, H - stageH);
    ctx.strokeStyle = navy(0.4); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, stageH); ctx.lineTo(W, stageH); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var fontBase = '-apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';
    if (!inp.active) {
      ctx.fillStyle = navy(0.6);
      ctx.font = '600 16px ' + fontBase;
      ctx.fillText(T.controlHint, W / 2, stageH + (H - stageH) / 2 - 12);
      ctx.font = '12px ' + fontBase;
      ctx.fillText(T.controlHint2, W / 2, stageH + (H - stageH) / 2 + 14);
    } else {
      // 触れた点、あそびの円、最大出力の円
      ctx.strokeStyle = navy(0.4); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(inp.originX, inp.originY, cfg.deadZonePx, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = navy(0.2);
      ctx.beginPath(); ctx.arc(inp.originX, inp.originY, cfg.fullPowerPx, 0, Math.PI * 2); ctx.stroke();
      if (ship.steps) {   // 3段階の機体：段が切り替わる位置の円
        for (var k = 1; k < 3; k++) {
          var rr = cfg.deadZonePx + cfg.stepThresholds[k] * (cfg.fullPowerPx - cfg.deadZonePx);
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
      ctx.font = '700 18px ' + fontBase;
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

  ID.render = { init: init, resize: resize, draw: draw };
})();
