// ステージ・くりまんじゅう・軌道・矢印・数値の描画
window.PB = window.PB || {};

(function () {
  var canvas, ctx, cfg, T, W = 0, H = 0, dpr = 1;
  var el = {}, hudBottom = 0, hudDirty = true;
  var L = null;           // 今のステージの座標の変換（layout で作る）
  var FONT = '-apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';
  var NV = '#1B2A49', WH = '#FFFFFF';

  // 星ごとの色。白とネイビーを基本に、差し色を1色だけ使う。
  var THEMES = {
    day:   { bgTop: '#E6EFFA', bgBottom: '#FFFFFF', fg: NV, fgA: 'rgba(27,42,73,', ground: NV, groundText: WH, accent: '#3B7DD8' },
    space: { bgTop: '#070C1A', bgBottom: '#16223D', fg: WH, fgA: 'rgba(255,255,255,', ground: '#A7AEB9', groundText: NV, accent: '#C9CED6' }
  };

  function init(canvasEl, config, texts) {
    canvas = canvasEl; ctx = canvas.getContext('2d'); cfg = config; T = texts;
    ['time', 'x', 'y', 'v'].forEach(function (k) {
      document.getElementById('lbl-' + k).textContent = T.hud[k];
      el[k] = document.getElementById('val-' + k);
    });
    el.world = document.getElementById('world-chip');
    resize();
  }
  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    hudDirty = true; L = null;
  }

  // ステージ全体が画面に収まるように、1 m あたりの px と原点の位置を決める
  function layout(stage) {
    var stageH = H * (1 - cfg.controlAreaRatio);
    var top = Math.max(hudBottom + 10, 60), bottom = 30;
    var s = Math.min((W - 24) / stage.width, (stageH - top - bottom) / stage.height);
    var ox = (W - stage.width * s) / 2, gy = stageH - bottom;
    L = { s: s, ox: ox, gy: gy, stageH: stageH, id: stage.id, w: W, h: H };
    return L;
  }
  function sx(x) { return L.ox + x * L.s; }
  function sy(y) { return L.gy - y * L.s; }
  function toWorldX(px) { return L ? (px - L.ox) / L.s : 0; }

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

  // ---------- くりまんじゅう（丸い配達ロボット） ----------
  // (x, y) は中心、R は半径 [px]、rot は回転 [rad]、face は表情（'normal' | 'happy' | 'oops'）
  function drawKuri(c, x, y, R, rot, face) {
    c.save();
    c.translate(x, y); c.rotate(rot || 0);
    var rx = R * 1.12, ry = R * 0.94, lw = Math.max(1.4, R * 0.09);
    // アンテナ
    c.strokeStyle = NV; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath(); c.moveTo(R * 0.15, -ry * 0.92); c.lineTo(R * 0.32, -ry * 1.32); c.stroke();
    c.fillStyle = '#E8A33D'; c.beginPath(); c.arc(R * 0.32, -ry * 1.32, R * 0.14, 0, Math.PI * 2); c.fill(); c.stroke();
    // からだ（下はクリーム色の生地）
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = '#F4DDB2'; c.fill();
    // 上はつやのある栗色の焼き目
    c.save();
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#9C5A2B';
    c.beginPath(); c.ellipse(0, -ry * 0.18, rx * 1.05, ry * 0.78, 0, Math.PI, 0); c.lineTo(rx * 1.05, -ry * 0.05);
    c.quadraticCurveTo(0, ry * 0.12, -rx * 1.05, -ry * 0.05); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.beginPath(); c.ellipse(-rx * 0.35, -ry * 0.62, rx * 0.28, ry * 0.12, -0.3, 0, Math.PI * 2); c.fill();
    c.restore();
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    c.strokeStyle = NV; c.lineWidth = lw; c.stroke();
    // けしの実
    c.fillStyle = '#FFF8E8';
    c.beginPath(); c.ellipse(rx * 0.08, -ry * 0.62, R * 0.09, R * 0.05, 0.3, 0, Math.PI * 2); c.fill();
    // 顔
    c.fillStyle = NV; c.strokeStyle = NV;
    if (face === 'happy') {
      c.lineWidth = lw;
      c.beginPath(); c.arc(-R * 0.36, R * 0.36, R * 0.11, Math.PI, 0); c.stroke();
      c.beginPath(); c.arc(R * 0.36, R * 0.36, R * 0.11, Math.PI, 0); c.stroke();
    } else if (face === 'oops') {
      c.lineWidth = lw;
      [-1, 1].forEach(function (k) {
        c.beginPath(); c.moveTo(k * R * 0.36 - R * 0.09, R * 0.27); c.lineTo(k * R * 0.36 + R * 0.09, R * 0.43);
        c.moveTo(k * R * 0.36 + R * 0.09, R * 0.27); c.lineTo(k * R * 0.36 - R * 0.09, R * 0.43); c.stroke();
      });
    } else {
      c.beginPath(); c.ellipse(-R * 0.36, R * 0.34, R * 0.08, R * 0.11, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(R * 0.36, R * 0.34, R * 0.08, R * 0.11, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(232,120,120,0.45)';   // ほっぺ
    c.beginPath(); c.ellipse(-R * 0.62, R * 0.52, R * 0.12, R * 0.07, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(R * 0.62, R * 0.52, R * 0.12, R * 0.07, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function arrow(x1, y1, x2, y2, filled, color, back) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 3) return;
    var ux = dx / len, uy = dy / len, head = Math.min(11, len * 0.6), half = head * 0.55;
    var bx = x2 - ux * head, by = y2 - uy * head;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    ctx.lineWidth = filled ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(bx - uy * half, by + ux * half); ctx.lineTo(bx + uy * half, by - ux * half); ctx.closePath();
    if (filled) ctx.fill(); else { ctx.lineWidth = 2; ctx.fillStyle = back; ctx.fill(); ctx.stroke(); }
  }

  function label(text, x, y, color, bg, align) {
    ctx.font = '600 12px ' + FONT;
    var w = ctx.measureText(text).width + 10;
    var lx = align === 'left' ? x : (align === 'right' ? x - w : x - w / 2);
    lx = Math.max(4, Math.min(W - w - 4, lx));
    roundRect(ctx, lx, y - 10, w, 20, 6); ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, lx + 5, y + 0.5);
  }

  // 星空（宇宙のテーマ用）。ステージごとに決まった並び。
  var stars = null, starsFor = null;
  function drawStars(stage, stageH) {
    if (starsFor !== stage.id) {
      var a = 12345 + stage.id.charCodeAt(1) * 77;
      stars = [];
      for (var i = 0; i < 90; i++) {
        a = (a * 1664525 + 1013904223) >>> 0; var x = a / 4294967296;
        a = (a * 1664525 + 1013904223) >>> 0; var y = a / 4294967296;
        a = (a * 1664525 + 1013904223) >>> 0; var r = a / 4294967296;
        stars.push({ x: x, y: y, r: 0.5 + r * 1.2, al: 0.3 + r * 0.6 });
      }
      starsFor = stage.id;
    }
    stars.forEach(function (p) {
      ctx.fillStyle = 'rgba(255,255,255,' + p.al + ')';
      ctx.beginPath(); ctx.arc(p.x * W, p.y * stageH, p.r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function niceStep(s) {   // 目盛りの間隔：40 px 以上になる、きりのよい長さ [m]
    var steps = [1, 2, 5, 10, 20, 25, 50, 100];
    for (var i = 0; i < steps.length; i++) if (steps[i] * s >= 40) return steps[i];
    return 100;
  }

  // view = { st, stage, world, mode, aim:{v,theta}, pred (予測線), pin (予測の x), fx:{hit:進み具合, miss:bool}, dt }
  function draw(view) {
    var st = view.st, stage = view.stage, world = view.world, th = THEMES[world.theme];
    if (!L || L.id !== stage.id || L.w !== W || L.h !== H) layout(stage);
    var s = L.s, stageH = L.stageH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 背景
    var bg = ctx.createLinearGradient(0, 0, 0, stageH);
    bg.addColorStop(0, th.bgTop); bg.addColorStop(1, th.bgBottom);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, stageH);
    if (world.theme === 'space') {
      drawStars(stage, stageH);
      // 空に浮かぶ地球
      var ex = W - 46, ey = hudBottom + 44;
      ctx.fillStyle = '#3B7DD8'; ctx.beginPath(); ctx.arc(ex, ey, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(ex - 4, ey - 4, 7, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + 5, ey + 6, 5, 2, 0.3, 0, Math.PI * 2); ctx.fill();
    }

    // 方眼（目盛りと同じ間隔）
    // 横の目盛りは、発射台の位置を 0 m とする
    var step = niceStep(s), x0 = stage.launch.x;
    function rel(x) { return x - x0; }
    ctx.strokeStyle = th.fgA + '0.09)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = x0 - Math.floor(x0 / step) * step; gx <= stage.width; gx += step) { ctx.moveTo(sx(gx), 0); ctx.lineTo(sx(gx), L.gy); }
    for (var gy = step; sy(gy) > 0; gy += step) { ctx.moveTo(0, sy(gy)); ctx.lineTo(W, sy(gy)); }
    ctx.stroke();
    // 高さの目盛りの数字（左端）
    ctx.fillStyle = th.fgA + '0.45)'; ctx.font = '10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (gy = step; sy(gy) > hudBottom + 12; gy += step) ctx.fillText(gy + ' m', 3, sy(gy) - 1);

    // 地面と目盛り
    ctx.fillStyle = th.ground; ctx.fillRect(0, L.gy, W, stageH - L.gy);
    ctx.fillStyle = th.groundText; ctx.font = '600 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.strokeStyle = th.groundText; ctx.lineWidth = 1;
    for (gx = x0; gx <= stage.width + 1e-9; gx += step) {
      ctx.beginPath(); ctx.moveTo(sx(gx), L.gy); ctx.lineTo(sx(gx), L.gy + 5); ctx.stroke();
      ctx.fillText(String(Math.round(rel(gx))), sx(gx), L.gy + 7);
    }
    ctx.textAlign = 'right'; ctx.fillText('[m]', W - 4, L.gy + 17);

    // 台と壁
    ctx.fillStyle = th.ground;
    stage.rects.forEach(function (r) { ctx.fillRect(sx(r.x), sy(r.y + r.h), r.w * s, r.h * s); });

    // 受け取りカゴ
    var b = stage.basket, bw = b.w * s, bh = Math.max(12, 0.9 * s), bx = sx(b.x - b.w / 2), by = sy(b.y);
    var hitK = view.fx && view.fx.hit != null ? view.fx.hit : -1;
    ctx.fillStyle = hitK >= 0 ? th.accent : th.fgA + '0.12)';
    ctx.fillRect(bx, by - bh, bw, bh);
    ctx.strokeStyle = th.fg; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by - bh); ctx.lineTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by - bh); ctx.stroke();
    // 旗
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + bw, by - bh); ctx.lineTo(bx + bw, by - bh - 26); ctx.stroke();
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.moveTo(bx + bw, by - bh - 26); ctx.lineTo(bx + bw + 14, by - bh - 21); ctx.lineTo(bx + bw, by - bh - 16); ctx.closePath(); ctx.fill();

    // カゴまでの距離（中心）
    ctx.fillStyle = th.fg; ctx.font = '600 11px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(rel(b.x).toFixed(1) + ' m', sx(b.x), by - bh - 4);

    // 発射台
    var lx = sx(stage.launch.x), ly = sy(stage.launch.y);
    ctx.fillStyle = th.fg; roundRect(ctx, lx - 14, ly - 6, 28, 6, 2); ctx.fill();
    ctx.strokeStyle = th.fg; ctx.lineWidth = 2; ctx.beginPath();
    for (var z = 0; z < 3; z++) { ctx.moveTo(lx - 8, ly - 8 - z * 5); ctx.lineTo(lx + 8, ly - 10 - z * 5); }
    ctx.stroke();

    var R = Math.max(9, 0.5 * s);   // くりまんじゅうの半径 [px]
    var flying = st.flying, landed = st.done;

    // 予測の段階：着地点の予測（たて線）
    if (view.pin != null) {
      var px = sx(view.pin);
      ctx.strokeStyle = th.accent; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(px, hudBottom + 30); ctx.lineTo(px, L.gy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(px, L.gy - 4, 5, 0, Math.PI * 2); ctx.fill();
      label(T.predictLabel + ' ' + rel(view.pin).toFixed(1) + ' m', px, hudBottom + 30, world.theme === 'space' ? NV : WH, th.accent);
    }

    // 体感の段階：予測線（狙っている間だけ）
    if (!flying && !landed && view.pred) {
      ctx.strokeStyle = th.fgA + '0.55)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath();
      view.pred.points.forEach(function (p, i) { if (i === 0) ctx.moveTo(sx(p.x), sy(p.y)); else ctx.lineTo(sx(p.x), sy(p.y)); });
      ctx.stroke(); ctx.setLineDash([]);
    }

    // 等しい時間ごとの点（ストロボ）
    ctx.fillStyle = th.fgA + '0.55)';
    st.trail.forEach(function (p) { ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 3, 0, Math.PI * 2); ctx.fill(); });

    // 着地のあと：最高点と着地点
    if (landed) {
      var apy = sy(st.maxY);
      ctx.strokeStyle = th.fgA + '0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sx(stage.launch.x), apy); ctx.lineTo(W - 8, apy); ctx.stroke(); ctx.setLineDash([]);
      label(T.apexLabel + ' ' + st.maxY.toFixed(2) + ' m', 8, apy, world.theme === 'space' ? NV : WH, th.fg, 'left');
      label(T.landLabel + ' ' + rel(st.x).toFixed(2) + ' m', sx(st.x), L.gy - R * 2 - 18, world.theme === 'space' ? NV : WH, th.fg);
    }

    // 狙いの矢印と角度（投げる前）
    if (!flying && !landed) {
      var al = view.aim.v / cfg.vMax * cfg.arrowFullPx, rad = view.aim.theta * Math.PI / 180;
      var cx0 = lx, cy0 = ly - R - 6;
      if (view.aim.v > 0) arrow(cx0, cy0, cx0 + Math.cos(rad) * al, cy0 - Math.sin(rad) * al, true, th.accent);
      ctx.strokeStyle = th.fgA + '0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + 44, cy0); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx0, cy0, 30, -rad, 0); ctx.stroke();
      ctx.fillStyle = th.fg; ctx.font = '600 11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(view.aim.theta + '°', cx0 + 34, cy0 - 12);
      drawKuri(ctx, lx, ly - R - 6, R, 0, 'normal');
    } else {
      var face = landed ? (st.result === 'hit' ? 'happy' : 'oops') : 'normal';
      var rot = landed ? 0 : st.t * 6;
      var kx = sx(st.x), ky = sy(st.y) - (landed ? R * 0.9 : 0);
      drawKuri(ctx, kx, ky, R, rot, face);
      if (flying) {
        var v = Math.hypot(st.vx, st.vy);
        if (v > 0.05) {
          var vl = v / cfg.vMax * cfg.arrowFullPx;
          arrow(kx, ky, kx + st.vx / v * vl, ky - st.vy / v * vl, true, th.accent);       // 速度（塗り）
        }
        arrow(kx, ky, kx, ky + world.g * cfg.accArrowPxPerG, false, th.fg, th.bgBottom);  // 加速度（線のみ）
      }
    }

    // 配達完了の表示
    if (hitK >= 0) {
      var pop = Math.min(1, hitK / 0.2), tw = 170, tht = 44, tx = W / 2 - tw / 2, ty = hudBottom + 50;
      ctx.globalAlpha = pop;
      roundRect(ctx, tx, ty, tw, tht, 10); ctx.fillStyle = th.fg; ctx.fill();
      ctx.fillStyle = world.theme === 'space' ? NV : WH; ctx.font = '700 22px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(T.success, W / 2, ty + tht / 2 + 1);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = th.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx(b.x), by - bh / 2, 10 + hitK * 40, 0, Math.PI * 2);
      ctx.globalAlpha = Math.max(0, 1 - hitK); ctx.stroke(); ctx.globalAlpha = 1;
    }

    // 操作エリア
    ctx.fillStyle = '#F1F3F7'; ctx.fillRect(0, stageH, W, H - stageH);
    ctx.strokeStyle = 'rgba(27,42,73,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, stageH); ctx.lineTo(W, stageH); ctx.stroke();
    var d = PB.input.drag, midY = stageH + (H - stageH) * 0.47;
    if (d.active) {
      ctx.strokeStyle = 'rgba(27,42,73,0.25)';
      ctx.beginPath(); ctx.arc(d.ox, d.oy, cfg.aimFullPx, -Math.PI / 2, 0); ctx.stroke();
      arrow(d.ox, d.oy, d.x, d.y, true, NV);
    } else if (!flying && !landed) {
      ctx.fillStyle = 'rgba(27,42,73,0.5)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 15px ' + FONT;
      ctx.fillText(view.mode === 'predict' && view.pin == null ? T.pinHint : T.aimHint, W / 2, midY - 9);
      ctx.font = '11px ' + FONT;
      ctx.fillText(T.aimHint2, W / 2, midY + 12);
    }

    // 数値（SI単位）
    var vNow = flying || landed ? Math.hypot(st.vx, st.vy) : 0;
    el.time.textContent = st.t.toFixed(2) + ' s';
    function m2(v) { return (Math.abs(v) < 0.005 ? 0 : v).toFixed(2); }   // −0.00 と出ないように
    el.x.textContent = m2(st.x - stage.launch.x) + ' m';
    el.y.textContent = m2(st.y - stage.launch.y) + ' m';
    el.v.textContent = (landed ? 0 : vNow).toFixed(2) + ' m/s';
    if (hudDirty) {
      hudBottom = document.getElementById('hud').getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
      hudDirty = false; L = null;
    }
  }

  PB.render = { init: init, resize: resize, draw: draw, drawKuri: drawKuri, toWorldX: toWorldX,
                setWorldChip: function (text) { el.world.textContent = text; } };
})();
