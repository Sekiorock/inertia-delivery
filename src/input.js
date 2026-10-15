// 指とマウスの操作（仕様書 4章）
// 操作エリアに触れて指をずらすと、ずらした向きに噴射する。
window.ID = window.ID || {};

(function () {
  var s = {
    active: false, pointerId: null,
    originX: 0, originY: 0,   // 最初に触れた点 [px]
    curX: 0, curY: 0,         // 今の指の位置 [px]
    enabled: true
  };
  var canvas = null, cfg = null;

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, h: r.height };
  }

  function down(e) {
    if (!s.enabled || s.active) return;
    var p = pos(e);
    if (p.y < p.h * (1 - cfg.controlAreaRatio)) return;   // 操作エリアの外
    s.active = true; s.pointerId = e.pointerId;
    s.originX = s.curX = p.x; s.originY = s.curY = p.y;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }
  function move(e) {
    if (!s.active || e.pointerId !== s.pointerId) return;
    var p = pos(e);
    s.curX = p.x; s.curY = p.y;
    e.preventDefault();
  }
  function up(e) {
    if (!s.active || e.pointerId !== s.pointerId) return;
    s.active = false; s.pointerId = null;
  }

  function init(canvasEl, config) {
    canvas = canvasEl; cfg = config;
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    // ピンチでの拡大やスクロールを無効にする
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

  // 今の操作を噴射の指示に直す。画面は下が正なので、yの向きを反転する。
  function getCommand() {
    if (!s.active || !s.enabled) return { on: false, dirX: 0, dirY: 0, level: 0 };
    var dx = s.curX - s.originX, dy = s.curY - s.originY;
    var d = Math.hypot(dx, dy);
    if (d <= cfg.deadZonePx) return { on: false, dirX: 0, dirY: 0, level: 0 };
    var level = (d - cfg.deadZonePx) / (cfg.fullPowerPx - cfg.deadZonePx);
    if (level > 1) level = 1;
    return { on: true, dirX: dx / d, dirY: -dy / d, level: level };
  }

  function reset() { s.active = false; s.pointerId = null; }
  function setEnabled(v) { s.enabled = v; if (!v) reset(); }

  ID.input = { init: init, getCommand: getCommand, reset: reset, setEnabled: setEnabled, state: s };
})();
