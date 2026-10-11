// 起動、画面の切り替え、ゲームの進行
// 段階1はプレイ画面だけ。タイトルや機体選択は後の段階で追加する。
window.ID = window.ID || {};

(function () {
  var cfg = ID.config, T = ID.texts;
  var stage = ID.stages[0];
  var ship = cfg.ships[cfg.defaultShip];
  var st = null, paused = false, lastTime = 0, acc = 0;
  var DT = 1 / cfg.physicsHz;

  var canvas = document.getElementById('game');
  var overlay = document.getElementById('overlay');
  var oTitle = document.getElementById('overlay-title');
  var oBody = document.getElementById('overlay-body');
  var oMain = document.getElementById('overlay-main');
  var oSub = document.getElementById('overlay-sub');
  var mainAction = null, subAction = null;

  function showOverlay(title, body, mainLabel, onMain, subLabel, onSub) {
    oTitle.textContent = title; oBody.textContent = body;
    oMain.textContent = mainLabel; mainAction = onMain;
    if (subLabel) { oSub.hidden = false; oSub.textContent = subLabel; subAction = onSub; }
    else { oSub.hidden = true; subAction = null; }
    overlay.hidden = false;
    ID.input.setEnabled(false);
  }
  function hideOverlay() { overlay.hidden = true; ID.input.setEnabled(true); }

  function start() {
    st = ID.physics.createState(stage, ship);
    paused = false; acc = 0;
    hideOverlay();
  }

  function pause() {
    if (paused || st.status !== 'playing') return;
    paused = true;
    showOverlay(T.paused, '', T.resume, function () { paused = false; hideOverlay(); }, T.restart, start);
  }

  function finish() {
    if (st.status === 'success') {
      var body = T.resultTime + '　' + st.t.toFixed(1) + ' s\n' +
        T.resultFuel + '　' + st.fuel.toFixed(2) + ' kg\n' +
        T.resultCost + '　' + Math.round(st.fuel * cfg.fuelPrice).toLocaleString('ja-JP') + '円\n' +
        T.resultOffset + '　' + st.offset.toFixed(2) + ' m';
      showOverlay(T.success, body, T.retry, start);
    } else {
      showOverlay(T.out, T.outBody, T.retry, start);
    }
  }

  function frame(now) {
    var dt = (now - lastTime) / 1000; lastTime = now;
    if (dt > 0.1) dt = 0.1;   // タブを離れていた間の分は進めない
    var cmd = ID.input.getCommand();
    if (!paused && st.status === 'playing') {
      acc += dt;
      while (acc >= DT) {      // 物理は1秒に120回の固定間隔
        ID.physics.step(st, cmd, DT, ship, stage, cfg);
        acc -= DT;
        if (st.status !== 'playing') { finish(); break; }
      }
    }
    ID.render.draw(st, stage, ship, ID.input.state, cmd);
    requestAnimationFrame(frame);
  }

  oMain.addEventListener('click', function () { if (mainAction) mainAction(); });
  oSub.addEventListener('click', function () { if (subAction) subAction(); });
  document.getElementById('btn-pause').addEventListener('click', pause);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  window.addEventListener('resize', ID.render.resize);
  window.addEventListener('orientationchange', ID.render.resize);

  ID.input.init(canvas, cfg);
  ID.render.init(canvas, cfg, T);
  ID.audio.init();
  start();
  lastTime = performance.now();
  requestAnimationFrame(frame);

  ID.debug = { getState: function () { return st; }, stage: stage, ship: ship };
})();
