// 指とマウスの操作
// 操作エリアをなぞると、なぞった向きが打ち出しの角度、長さが速さになる。
// 予測の段階では、ステージをタップして着地点の予測を置く。
window.PB = window.PB || {};

(function () {
  var canvas, cfg, handlers;
  var drag = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, h: r.height };
  }
  function down(e) {
    if (drag.active || !handlers.enabled()) return;
    var p = pos(e);
    if (p.y < p.h * (1 - cfg.controlAreaRatio)) {   // ステージをタップ
      handlers.tapStage(p.x, p.y);
      return;
    }
    drag.active = true; drag.id = e.pointerId;
    drag.ox = drag.x = p.x; drag.oy = drag.y = p.y;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }
  function move(e) {
    if (!drag.active || e.pointerId !== drag.id) return;
    var p = pos(e); drag.x = p.x; drag.y = p.y;
    var dx = drag.x - drag.ox, dy = drag.oy - drag.y, d = Math.hypot(dx, dy);
    if (d > cfg.deadZonePx) {
      var th = Math.atan2(dy, dx) * 180 / Math.PI;
      th = Math.max(0, Math.min(90, th));
      var v = Math.min(1, (d - cfg.deadZonePx) / (cfg.aimFullPx - cfg.deadZonePx)) * cfg.vMax;
      handlers.aim(v, th);
    }
    e.preventDefault();
  }
  function up(e) { if (drag.active && e.pointerId === drag.id) { drag.active = false; drag.id = null; } }

  function init(canvasEl, config, h) {
    canvas = canvasEl; cfg = config; handlers = h;
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    var stop = function (e) { e.preventDefault(); };
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('gesturestart', stop);
    document.addEventListener('gesturechange', stop);
    document.addEventListener('contextmenu', stop);
    var lastTap = 0;
    document.addEventListener('touchend', function (e) {   // ダブルタップ拡大の防止
      var now = Date.now();
      if (now - lastTap < 350 && e.target === canvas) e.preventDefault();
      lastTap = now;
    }, { passive: false });
  }

  // 押し続けると連続で変わるボタン（微調整用）
  function repeatButton(el, fn) {
    var t1 = 0, t2 = 0;
    function stopIt() { clearTimeout(t1); clearInterval(t2); }
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); fn();
      stopIt();
      t1 = setTimeout(function () { t2 = setInterval(fn, 70); }, 380);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, stopIt); });
  }

  PB.input = { init: init, drag: drag, repeatButton: repeatButton };
})();
