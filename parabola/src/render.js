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
    table: { bgTop: '#F5F2EA', bgBottom: '#E9E2D2', fg: NV, fgA: 'rgba(27,42,73,', ground: NV, groundText: WH, accent: '#2E9E78' },
    mars: { bgTop: '#E8B48E', bgBottom: '#F7E3D2', fg: NV, fgA: 'rgba(27,42,73,', ground: '#A5532F', groundText: WH, accent: '#C2562B' },
    jupiter: { bgTop: '#D9A86A', bgBottom: '#F6E4C4', fg: NV, fgA: 'rgba(27,42,73,', ground: NV, groundText: WH, accent: '#B5651D' },
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
    if (world.theme === 'mars') {   // 火星の空に、2つの小さな衛星
      ctx.fillStyle = 'rgba(120,80,60,0.55)';
      ctx.beginPath(); ctx.arc(W - 60, hudBottom + 50, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W - 34, hudBottom + 72, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (world.theme === 'jupiter') {   // 木星の雲のしま模様
      for (var bi = 0; bi < 6; bi++) {
        ctx.fillStyle = bi % 2 ? 'rgba(181,101,29,0.10)' : 'rgba(255,255,255,0.12)';
        ctx.fillRect(0, stageH * (0.15 + bi * 0.13), W, stageH * 0.06);
      }
    }
    if (world.theme === 'space') {
      drawStars(stage, stageH);
      // 空に浮かぶ地球
      var ex = W - 46, ey = hudBottom + 44;
      ctx.fillStyle = '#3B7DD8'; ctx.beginPath(); ctx.arc(ex, ey, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(ex - 4, ey - 4, 7, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + 5, ey + 6, 5, 2, 0.3, 0, Math.PI * 2); ctx.fill();
    }

    // 斜面のテーブル：右上に横から見た坂の図と、下り向きの矢印
    if (world.slope) {
      var bx0 = W - 92, by0 = hudBottom + 62, bl = 64, ar = world.slope * Math.PI / 180;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(ctx, bx0 - 10, by0 - 50, 96, 64, 8); ctx.fill();
      ctx.strokeStyle = NV; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(46,158,120,0.25)';
      var hh = Math.min(42, bl * Math.tan(ar)), ww = hh / Math.tan(ar);
      ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx0 + ww, by0); ctx.lineTo(bx0 + ww, by0 - hh); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx0, by0, 14, -ar, 0); ctx.stroke();
      ctx.fillStyle = NV; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(world.slope + '°', bx0 + ww + 6, by0 - 8);
      // テーブルの左側に「下り」の矢印
      arrow(W - 18, by0 + 34, W - 18, by0 + 84, true, th.accent);
      ctx.fillStyle = th.accent; ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText(T.slopeDown, W - 18, by0 + 24);
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

    // 斜面のテーブル：上の端
    if (stage.topRail) {
      ctx.fillStyle = 'rgba(27,42,73,0.08)'; ctx.fillRect(0, 0, W, sy(stage.height));   // テーブルの外
      ctx.fillStyle = th.ground; ctx.fillRect(0, sy(stage.height) - 4, W, 4);
    }

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

    var R = Math.max(9, (stage.kuriR || 0.5) * s);   // くりまんじゅうの半径 [px]
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

    // 影：床（x の影）と左の壁（y の影）。水平は等速、鉛直は投げ上げの動きになる
    var showArrows = view.arrows !== false;
    if (view.shadow && (flying || landed)) {
      var wx = Math.max(8, sx(stage.launch.x) - 18), gyS = L.gy - 4;
      ctx.strokeStyle = th.fgA + '0.3)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(wx, L.gy); ctx.lineTo(wx, hudBottom + 30); ctx.stroke(); ctx.setLineDash([]);
      if (view.guides) {
        ctx.strokeStyle = th.fgA + '0.18)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath();
        st.trail.forEach(function (p) {
          ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(sx(p.x), gyS);
          ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(wx, sy(p.y));
        });
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = th.accent;
      st.trail.forEach(function (p) {
        ctx.beginPath(); ctx.arc(sx(p.x), gyS, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(wx, sy(p.y), 2.5, 0, Math.PI * 2); ctx.fill();
      });
      var shx = sx(st.x), shy = sy(st.y);
      ctx.strokeStyle = th.fg; ctx.lineWidth = 1.5;
      ctx.fillRect(shx - 5, gyS - 5, 10, 10); ctx.strokeRect(shx - 5, gyS - 5, 10, 10);
      ctx.fillRect(wx - 5, shy - 5, 10, 10); ctx.strokeRect(wx - 5, shy - 5, 10, 10);
      ctx.fillStyle = th.fgA + '0.6)'; ctx.font = '600 10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(T.shadowY, wx + 4, hudBottom + 30);
      ctx.textAlign = 'right'; ctx.fillText(T.shadowX + '（床）', W - 8, gyS - 8);
      if (flying && showArrows) {   // 影の上の速度の成分
        var k2 = cfg.arrowFullPx / cfg.vMax;
        arrow(shx, gyS - 12, shx + st.vx * k2, gyS - 12, true, th.accent);
        arrow(wx + 12, shy, wx + 12, shy - st.vy * k2, true, th.accent);
      }
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
      if (view.freeze) {   // 途中停止クイズ：止まっていることを示す輪
        ctx.strokeStyle = th.accent; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(kx, ky, R + 8 + 3 * Math.sin(performance.now() / 150), 0, Math.PI * 2); ctx.stroke();
      }
      if (flying && showArrows) {
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
    el.y.textContent = m2(st.y) + ' m';   // 地面からの高さ
    el.v.textContent = (landed ? 0 : vNow).toFixed(2) + ' m/s';
    if (hudDirty) {
      hudBottom = document.getElementById('hud').getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
      hudDirty = false; L = null;
    }
  }

  // ================= 第1章「直線便」 =================
  // 下の操作エリアに v-t グラフ、上に横から見たレールと台車を描く。
  var G = null;   // グラフの枠 [px]
  function graphRect(stage) {
    var top = H * (1 - cfg.controlAreaRatio);
    var gx = 46, gw = W - gx - 14, gy = top + 72, gh = Math.max(80, H - 76 - gy);
    G = { x: gx, y: gy, w: gw, h: gh, T: stage.T, vMin: stage.vMin, vMax: stage.vMax };
    return G;
  }
  function gX(t) { return G.x + t / G.T * G.w; }
  function gY(v) { return G.y + (G.vMax - v) / (G.vMax - G.vMin) * G.h; }

  function drawCart(c, x, y, s, R, face) {
    // 台車（車輪つきの台）と、その上に乗ったくりまんじゅう
    var w = Math.max(30, 1.8 * s), h = Math.max(10, 0.35 * s), wr = Math.max(5, 0.22 * s);
    c.fillStyle = NV; c.strokeStyle = NV; c.lineWidth = 2;
    roundRect(c, x - w / 2, y - wr * 2 - h, w, h, 3); c.fillStyle = '#3B7DD8'; c.fill(); c.stroke();
    c.fillStyle = WH;
    [-w * 0.3, w * 0.3].forEach(function (dx) { c.beginPath(); c.arc(x + dx, y - wr, wr, 0, Math.PI * 2); c.fill(); c.stroke(); });
    drawKuri(c, x, y - wr * 2 - h - R * 0.85, R, 0, face);
  }

  function drawLine(view) {
    var stage = view.stage, th = THEMES.day, info = view.info, run = view.run;
    var stageH = H * (1 - cfg.controlAreaRatio);
    graphRect(stage);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // ---- 上：レール
    var bg = ctx.createLinearGradient(0, 0, 0, stageH);
    bg.addColorStop(0, th.bgTop); bg.addColorStop(1, th.bgBottom);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, stageH);
    var x0m = -1.5, x1m = stage.width, s = (W - 16) / (x1m - x0m);
    function sx(x) { return 8 + (x - x0m) * s; }
    var ry = Math.round(stageH * 0.62);
    // 目盛り
    var step = s * 2 >= 34 ? 2 : (s * 5 >= 34 ? 5 : 10);
    ctx.strokeStyle = 'rgba(27,42,73,0.1)'; ctx.lineWidth = 1; ctx.beginPath();
    for (var gx = 0; gx <= x1m; gx += step) { ctx.moveTo(sx(gx), hudBottom + 30); ctx.lineTo(sx(gx), ry); }
    ctx.stroke();
    ctx.fillStyle = NV; ctx.fillRect(0, ry, W, 6);
    ctx.font = '600 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (gx = 0; gx <= x1m; gx += step) { ctx.fillRect(sx(gx) - 0.5, ry + 6, 1, 5); ctx.fillText(String(gx), sx(gx), ry + 13); }
    ctx.textAlign = 'right'; ctx.fillText('[m]', W - 4, ry + 13);
    // ホーム（届け先）と許容範囲
    stage.targets.forEach(function (tx, i) {
      var last = i === stage.targets.length - 1;
      var name = stage.targets.length > 1 ? (last ? T.depot : T.dest) : T.station;
      ctx.fillStyle = 'rgba(59,125,216,0.18)';
      ctx.fillRect(sx(tx - stage.tol), ry - 46, (2 * stage.tol) * s, 46);
      ctx.fillStyle = NV; ctx.fillRect(sx(tx - stage.tol) - 6, ry - 8, (2 * stage.tol) * s + 12, 8);
      ctx.strokeStyle = NV; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(tx), ry - 8); ctx.lineTo(sx(tx), ry - 96); ctx.stroke();
      label(name + ' ' + tx + ' m', sx(tx), ry - 104, WH, NV);
    });
    // 予定の到着位置（体感の段階だけ）
    if (view.showNumbers && info && !run) {
      ctx.strokeStyle = 'rgba(27,42,73,0.45)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx(info.endX), ry - 4); ctx.lineTo(sx(info.endX), ry - 40); ctx.stroke(); ctx.setLineDash([]);
    }
    // 1秒ごとの位置（ストロボ）
    if (run) {
      ctx.fillStyle = '#3B7DD8';
      run.trail.forEach(function (p, i) {
        ctx.beginPath(); ctx.arc(sx(p.x), ry + 30, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(27,42,73,0.55)'; ctx.font = '9px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText((i + 1) + 's', sx(p.x), ry + 36); ctx.fillStyle = '#3B7DD8';
      });
    }
    // 台車
    var now = run ? run.now : { x: 0, v: 0, a: 0 };
    var R = Math.max(10, 0.45 * s), cx = sx(now.x);
    var face = view.result === 'hit' ? 'happy' : (view.result ? 'oops' : 'normal');
    drawCart(ctx, cx, ry, s, R, face);
    var cy = ry - 40 - R;
    if (run && view.arrows !== false) {
      if (Math.abs(now.v) > 0.02) arrow(cx, cy - 22, cx + now.v / stage.vMax * 70, cy - 22, true, '#3B7DD8');
      if (Math.abs(now.a) > 1e-9) arrow(cx, cy - 6, cx + now.a / stage.aMax * 40, cy - 6, false, NV, WH);
    }
    if (view.freeze) {
      ctx.strokeStyle = '#3B7DD8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, ry - 30, 34 + 3 * Math.sin(performance.now() / 150), 0, Math.PI * 2); ctx.stroke();
    }
    if (view.fx && view.fx.hit != null) {
      var pop = Math.min(1, view.fx.hit / 0.2);
      ctx.globalAlpha = pop; roundRect(ctx, W / 2 - 85, hudBottom + 44, 170, 44, 10); ctx.fillStyle = NV; ctx.fill();
      ctx.fillStyle = WH; ctx.font = '700 22px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(T.success, W / 2, hudBottom + 67); ctx.globalAlpha = 1;
    }

    // ---- 下：v-t グラフ
    ctx.fillStyle = '#F1F3F7'; ctx.fillRect(0, stageH, W, H - stageH);
    ctx.strokeStyle = 'rgba(27,42,73,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, stageH); ctx.lineTo(W, stageH); ctx.stroke();
    ctx.fillStyle = WH; ctx.fillRect(G.x, G.y, G.w, G.h);
    // 方眼
    ctx.strokeStyle = 'rgba(27,42,73,0.1)'; ctx.beginPath();
    for (var tt = 0; tt <= G.T; tt++) { ctx.moveTo(gX(tt), G.y); ctx.lineTo(gX(tt), G.y + G.h); }
    for (var vv = Math.ceil(G.vMin); vv <= G.vMax; vv++) { ctx.moveTo(G.x, gY(vv)); ctx.lineTo(G.x + G.w, gY(vv)); }
    ctx.stroke();
    ctx.strokeStyle = NV; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(G.x, G.y); ctx.lineTo(G.x, G.y + G.h); ctx.moveTo(G.x, gY(0)); ctx.lineTo(G.x + G.w, gY(0)); ctx.stroke();
    ctx.fillStyle = NV; ctx.font = '10px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var vstep = G.vMax - G.vMin > 8 ? 2 : 1;
    for (vv = Math.ceil(G.vMin); vv <= G.vMax; vv += vstep) ctx.fillText(String(vv), G.x - 4, gY(vv));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (tt = 0; tt <= G.T; tt += (G.T > 10 ? 2 : 1)) ctx.fillText(String(tt), gX(tt), G.y + G.h + 3);
    ctx.font = '600 10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('v [m/s]', 4, G.y - 5);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('t [s]', W - 6, G.y + G.h + 14);
    if (info) {
      var pts = info.pts;
      // 面積（走った距離）。走っている間は、すでに走った部分を濃く塗る
      function areaPath(tEnd) {
        ctx.beginPath(); ctx.moveTo(gX(0), gY(0));
        for (var i = 0; i < pts.length; i++) {
          if (pts[i].t <= tEnd) ctx.lineTo(gX(pts[i].t), gY(pts[i].v));
          else { var nv = PB.line.at(info, tEnd).v; ctx.lineTo(gX(tEnd), gY(nv)); break; }
        }
        ctx.lineTo(gX(Math.min(tEnd, info.endT)), gY(0)); ctx.closePath();
      }
      ctx.fillStyle = 'rgba(59,125,216,0.13)'; areaPath(info.endT); ctx.fill();
      if (run) { ctx.fillStyle = 'rgba(59,125,216,0.38)'; areaPath(run.t); ctx.fill(); }
      // 折れ線。加速度が大きすぎる区間は点線で示す
      for (var i = 1; i < pts.length; i++) {
        var p = pts[i - 1], q = pts[i], a = (q.v - p.v) / ((q.t - p.t) || 1), bad = Math.abs(a) > stage.aMax + 1e-9;
        ctx.strokeStyle = NV; ctx.lineWidth = bad ? 4 : 3; ctx.setLineDash(bad ? [5, 4] : []);
        ctx.beginPath(); ctx.moveTo(gX(p.t), gY(p.v)); ctx.lineTo(gX(q.t), gY(q.v)); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (view.editable) {
        ctx.fillStyle = NV;
        pts.forEach(function (pp) { ctx.beginPath(); ctx.arc(gX(pp.t), gY(pp.v), 3.5, 0, Math.PI * 2); ctx.fill(); });
      }
      if (run) {   // 今の時刻
        ctx.strokeStyle = '#3B7DD8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(gX(run.t), G.y); ctx.lineTo(gX(run.t), G.y + G.h); ctx.stroke();
      }
      // グラフの上の一言
      ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      var msg = '';
      if (info.maxA > stage.aMax + 1e-9) msg = T.graphTooSteep.replace('{a}', stage.aMax.toFixed(1));
      else if (view.showNumbers) msg = T.graphArea.replace('{x}', info.endX.toFixed(2)) + '　' + T.graphMaxA.replace('{a}', info.maxA.toFixed(2));
      else if (view.editable && !run) msg = T.graphHint;
      ctx.fillStyle = NV; ctx.fillText(msg, G.x + 14, G.y - 5);
    }

    // 数値
    el.time.textContent = (run ? run.t : 0).toFixed(2) + ' s';
    el.x.textContent = now.x.toFixed(2) + ' m';
    el.y.textContent = now.v.toFixed(2) + ' m/s';
    el.v.textContent = (Math.abs(now.a) < 1e-9 ? 0 : now.a).toFixed(2) + ' m/s²';
    if (hudDirty) {
      hudBottom = document.getElementById('hud').getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
      hudDirty = false; L = null;
    }
  }

  PB.render = { drawLine: drawLine, graphRect: function (stage) { return graphRect(stage); }, init: init, resize: resize, draw: draw, drawKuri: drawKuri, toWorldX: toWorldX,
                setWorldChip: function (text) { el.world.textContent = text; } };
})();
