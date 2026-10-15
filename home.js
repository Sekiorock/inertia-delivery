// ホーム画面：カードの絵と、それぞれのゲームの所持金を出す
(function () {
  function $(id) { return document.getElementById(id); }
  function yen(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP') + '円'; }

  // 所持金（それぞれのゲームが端末に保存したもの）
  function wallet(key) {
    try { var d = JSON.parse(localStorage.getItem(key) || 'null'); return d && typeof d.wallet === 'number' ? d.wallet : null; }
    catch (e) { return null; }
  }
  // 仕事ごとの収益はそれぞれのゲームが保存し、ホームでは合計を所持金として出す
  var wi = wallet('inertia-delivery-v1'), wp = wallet('parabola-delivery-v1');
  $('wallet-inertia').textContent = '収益 ' + yen(wi || 0);
  $('wallet-parabola').textContent = '収益 ' + yen(wp || 0);
  $('total-amount').textContent = yen((wi || 0) + (wp || 0));

  function setup(cv) {
    var r = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * r); cv.height = Math.round(h * r);
    var c = cv.getContext('2d'); c.scale(r, r);
    return { c: c, w: w, h: h };
  }

  // 慣性デリバリー：宇宙の背景に、しずかとたけし
  function drawInertia() {
    var o = setup($('art-inertia')), c = o.c, w = o.w, h = o.h;
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#070C1A'); g.addColorStop(1, '#16223D');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    var a = 7;
    for (var i = 0; i < 60; i++) {
      a = (a * 1664525 + 1013904223) >>> 0; var x = a / 4294967296 * w;
      a = (a * 1664525 + 1013904223) >>> 0; var y = a / 4294967296 * h;
      a = (a * 1664525 + 1013904223) >>> 0; var s = a / 4294967296;
      c.fillStyle = 'rgba(255,255,255,' + (0.3 + s * 0.6) + ')';
      c.beginPath(); c.arc(x, y, 0.5 + s * 1.2, 0, Math.PI * 2); c.fill();
    }
    // 受け取り口
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 3;
    c.beginPath(); c.arc(w * 0.85, h * 0.3, 18, 0, Math.PI * 2); c.stroke();
    // 炎
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (var k = 0; k < 8; k++) { c.beginPath(); c.arc(w * 0.26 - 26 - k * 4, h * 0.62 + (k % 3 - 1) * 4, 3 - k * 0.25, 0, Math.PI * 2); c.fill(); }
    if (window.ID && ID.render && ID.render.drawShip) {
      ID.render.drawShip(c, 'shizuka', w * 0.26, h * 0.62, 46, true);
      ID.render.drawShip(c, 'takeshi', w * 0.55, h * 0.48, 66, true);
    }
  }

  // パラボラ便：空と地面、放物線の点、くりまんじゅう
  function drawParabola() {
    var o = setup($('art-parabola')), c = o.c, w = o.w, h = o.h;
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#E6EFFA'); g.addColorStop(1, '#FFFFFF');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1B2A49'; c.fillRect(0, h - 18, w, 18);
    var x0 = w * 0.1, x1 = w * 0.82, top = h * 0.18, base = h - 18;
    c.fillStyle = 'rgba(27,42,73,0.5)';
    for (var i = 0; i <= 14; i++) {
      var t = i / 14, x = x0 + (x1 - x0) * t, y = base - (base - top) * 4 * t * (1 - t);
      c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
    }
    // カゴと旗
    c.strokeStyle = '#1B2A49'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x1 - 16, base - 12); c.lineTo(x1 - 16, base); c.lineTo(x1 + 16, base); c.lineTo(x1 + 16, base - 12); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(x1 + 16, base - 12); c.lineTo(x1 + 16, base - 36); c.stroke();
    c.fillStyle = '#3B7DD8'; c.beginPath(); c.moveTo(x1 + 16, base - 36); c.lineTo(x1 + 30, base - 31); c.lineTo(x1 + 16, base - 26); c.closePath(); c.fill();
    if (window.PB && PB.render && PB.render.drawKuri) {
      var tk = 0.36, kx = x0 + (x1 - x0) * tk, ky = base - (base - top) * 4 * tk * (1 - tk);
      PB.render.drawKuri(c, kx, ky - 4, 22, -0.3, 'happy');
    }
  }

  function drawAll() { try { drawInertia(); } catch (e) {} try { drawParabola(); } catch (e) {} }
  drawAll();
  window.addEventListener('resize', drawAll);

  // QRコード
  $('btn-qr').addEventListener('click', function () { $('qr').hidden = false; });
  $('btn-qr-back').addEventListener('click', function () { $('qr').hidden = true; });
  if (/[?&]qr=1/.test(location.search)) $('qr').hidden = false;
})();
