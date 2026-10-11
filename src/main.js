// 起動、画面の切り替え、ゲームの進行
// 段階2：機体選択 → プレイ → 結果（給料と燃料代の天引き）
// タイトルやステージ選択は後の段階で追加する。
window.ID = window.ID || {};

(function () {
  var cfg = ID.config, T = ID.texts, P = ID.physics;
  var stage = ID.stages[0];
  var ship = cfg.ships[cfg.defaultShip];
  var st = null, paused = false, lastTime = 0, acc = 0;
  var mode = 'select';        // 'select' | 'play' | 'result'
  var wallet = 0;             // 所持金（保存は段階3で追加）
  var lastStep = -1;
  var DT = 1 / cfg.physicsHz;

  function $(id) { return document.getElementById(id); }
  function yen(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP') + T.yen; }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  var canvas = $('game');

  // ---------- 小さな確認用の重ね表示（一時停止・場外） ----------
  var overlay = $('overlay'), oMain = $('overlay-main'), oSub = $('overlay-sub');
  var mainAction = null, subAction = null;
  function showOverlay(title, body, mainLabel, onMain, subLabel, onSub) {
    $('overlay-title').textContent = title; $('overlay-body').textContent = body;
    oMain.textContent = mainLabel; mainAction = onMain;
    if (subLabel) { oSub.hidden = false; oSub.textContent = subLabel; subAction = onSub; }
    else { oSub.hidden = true; subAction = null; }
    overlay.hidden = false;
    ID.input.setEnabled(false);
  }
  function hideOverlay() { overlay.hidden = true; }

  // ---------- 機体選択 ----------
  function buildSelect() {
    $('select-request').innerHTML = '';
    var r = $('select-request');
    var b = document.createElement('b'); b.textContent = T.request + '：' + stage.name;
    r.appendChild(b); r.appendChild(document.createElement('br'));
    r.appendChild(document.createTextNode(
      T.basePay + ' ' + yen(stage.basePay) + '　／　' + T.targetTime + ' ' + stage.targetTime + ' s'));
    $('select-title').textContent = T.chooseShip;
    $('select-note').textContent = T.specFuelNote;

    var ships = cfg.shipOrder.map(function (k) { return cfg.ships[k]; });
    function est(s) { return 2 * s.mass * 2 / cfg.exhaustSpeed * cfg.fuelPrice; }   // 秒速2 mまで加速して止まる
    var maxMass = Math.max.apply(null, ships.map(function (s) { return s.mass; }));
    var maxAcc = Math.max.apply(null, ships.map(function (s) { return s.maxThrust / s.mass; }));
    var maxFuel = Math.max.apply(null, ships.map(est));

    var box = $('select-cards'); box.innerHTML = '';
    ships.forEach(function (s) {
      var card = document.createElement('button');
      card.type = 'button'; card.className = 'card'; card.id = 'card-' + s.id;
      function add(cls, text) { var d = document.createElement('div'); d.className = cls; if (text) d.textContent = text; card.appendChild(d); return d; }
      var pic = add('card-ship');
      var sq = document.createElement('i');
      sq.style.width = sq.style.height = Math.round(s.size * 22) + 'px';
      sq.style.background = s.color; pic.appendChild(sq);
      add('card-name', s.name);
      add('card-tag', s.tagline);
      function spec(label, value, ratio) {
        var d = add('spec');
        var l = document.createElement('span'); l.textContent = label;
        var v = document.createElement('b'); v.textContent = value;
        d.appendChild(l); d.appendChild(v);
        if (ratio != null) { var bar = add('bar'); var f = document.createElement('i'); f.style.width = Math.round(ratio * 100) + '%'; bar.appendChild(f); }
      }
      spec(T.specMass, s.mass.toLocaleString('ja-JP') + ' kg', s.mass / maxMass);
      spec(T.specAccel, (s.maxThrust / s.mass).toFixed(1) + ' m/s²', s.maxThrust / s.mass / maxAcc);
      spec(T.specFuel, yen(Math.round(est(s))), est(s) / maxFuel);
      spec(T.specControl, s.steps ? T.controlSteps : T.controlSmooth, null);
      spec(T.specStable, s.jitterDeg ? T.stableJitter : T.stableNone, null);
      add('card-go', s.name);
      card.addEventListener('click', function () { ship = s; start(); });
      box.appendChild(card);
    });
  }
  function showSelect() {
    mode = 'select';
    hideOverlay(); $('result').hidden = true; $('select').hidden = false;
    ID.input.setEnabled(false);
  }

  // ---------- プレイ ----------
  function start() {
    st = P.createState(stage, ship);
    paused = false; acc = 0; lastStep = -1; mode = 'play';
    hideOverlay(); $('select').hidden = true; $('result').hidden = true;
    stopAnim();
    ID.input.reset(); ID.input.setEnabled(true);
  }
  function pause() {
    if (mode !== 'play' || paused || st.status !== 'playing') return;
    paused = true;
    showOverlay(T.paused, '', T.resume, function () { paused = false; hideOverlay(); ID.input.setEnabled(true); },
      T.restart, start);
  }
  function finish() {
    if (st.status === 'success') showResult(P.calcPay(st, stage, cfg));
    else showOverlay(T.out, T.outBody, T.retry, start, T.changeShip, showSelect);
  }

  // ---------- 結果：総額を見せてから、燃料代を天引きする ----------
  var animId = 0, fast = false, timers = [];
  function stopAnim() { animId++; timers.forEach(clearTimeout); timers = []; }
  function showResult(pay) {
    mode = 'result'; ID.input.setEnabled(false);
    stopAnim(); fast = false;
    var my = animId;
    var amount = $('pay-amount'), box = $('pay-box'), slip = $('slip');
    $('result-title').textContent = T.success;
    function row(id, label, value) {
      var el = $(id); el.children[0].textContent = label; el.children[1].textContent = '+' + yen(value);
      el.classList.add('hide');
    }
    row('row-base', T.basePay, pay.base);
    row('row-precision', T.precisionBonus, pay.precision);
    row('row-speed', T.speedBonus, pay.speed);
    $('pay-label').textContent = T.gross; amount.textContent = yen(0);
    box.classList.remove('final'); box.classList.add('hide');
    $('slip-label').textContent = T.fuelSlip + '（' + st.fuel.toFixed(2) + ' kg）';
    $('slip-amount').textContent = '−' + yen(pay.fuelCost);
    slip.classList.remove('in');
    var stars = $('stars'); stars.innerHTML = '';
    for (var i = 0; i < 3; i++) { var sp = document.createElement('span'); sp.textContent = '★'; stars.appendChild(sp); }
    stars.classList.add('hide');
    $('wallet').classList.add('hide');
    $('result-buttons').classList.add('hide');
    $('skip-hint').textContent = T.skipHint;
    $('result').hidden = false;

    // 順番に進める小さな仕組み
    var queue = [];
    function wait(ms) { queue.push(function (next) { if (fast) next(); else timers.push(setTimeout(next, ms)); }); }
    function act(fn) { queue.push(function (next) { fn(); next(); }); }
    function count(from, to, ms) {
      queue.push(function (next) {
        var t0 = performance.now();
        (function tick(now) {
          if (my !== animId) return;
          var k = fast ? 1 : Math.min(1, (now - t0) / ms);
          var e = 1 - Math.pow(1 - k, 3);
          amount.textContent = yen(Math.round(from + (to - from) * e));
          if (k < 1) requestAnimationFrame(tick); else next();
        })(t0);
      });
    }
    function run() { if (my !== animId) return; var f = queue.shift(); if (f) f(run); }

    wait(500);
    act(function () { $('row-base').classList.remove('hide'); }); wait(250);
    act(function () { $('row-precision').classList.remove('hide'); }); wait(250);
    act(function () { $('row-speed').classList.remove('hide'); }); wait(250);
    act(function () { box.classList.remove('hide'); });
    count(0, pay.gross, 900);                       // 給料の総額が増えていく
    wait(700);
    act(function () { slip.classList.add('in'); }); // 燃料代の伝票が入ってくる
    wait(700);
    count(pay.gross, pay.net, 1200);                // 総額から燃料代が減っていく
    wait(300);
    act(function () {
      $('pay-label').textContent = pay.net < 0 ? T.deficit : T.net;
      if (pay.net < 0) $('result-title').textContent = T.deficit;
      box.classList.add('final');
      wallet += pay.net;                            // 赤字なら所持金からも引く
      $('wallet').textContent = T.wallet + '　' + yen(wallet);
      $('wallet').classList.remove('hide');
      stars.classList.remove('hide');
    });
    for (var j = 0; j < 3; j++) {
      (function (j) {
        wait(280);
        act(function () { if (j < pay.stars) stars.children[j].classList.add('on'); });
      })(j);
    }
    wait(200);
    act(function () { $('result-buttons').classList.remove('hide'); $('skip-hint').textContent = ''; });
    run();
  }

  // ---------- 毎フレームの処理 ----------
  function frame(now) {
    var dt = (now - lastTime) / 1000; lastTime = now;
    if (dt > 0.1) dt = 0.1;   // タブを離れていた間の分は進めない
    var cmd = ID.input.getCommand();
    if (mode === 'play' && !paused && st.status === 'playing') {
      // 3段階の機体：段が変わるたびに短く振動させる（音は段階4）
      var step = (cmd.on && ship.steps) ? P.stepIndex(cmd.level) : -1;
      if (step !== lastStep) { if (step >= 0) vibrate(20); lastStep = step; }
      acc += dt;
      while (acc >= DT) {      // 物理は1秒に120回の固定間隔
        P.step(st, cmd, DT, ship, stage, cfg);
        acc -= DT;
        if (st.status !== 'playing') { finish(); break; }
      }
    }
    ID.render.draw(st, stage, ship, ID.input.state, cmd);
    requestAnimationFrame(frame);
  }

  oMain.addEventListener('click', function () { if (mainAction) mainAction(); });
  oSub.addEventListener('click', function () { if (subAction) subAction(); });
  $('btn-pause').addEventListener('click', pause);
  $('btn-again').addEventListener('click', start);
  $('btn-change').addEventListener('click', showSelect);
  $('result').addEventListener('pointerdown', function () { fast = true; });   // タップで早送り
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  window.addEventListener('resize', ID.render.resize);
  window.addEventListener('orientationchange', ID.render.resize);

  $('btn-again').textContent = T.retry;
  $('btn-change').textContent = T.changeShip;

  ID.input.init(canvas, cfg);
  ID.render.init(canvas, cfg, T);
  ID.audio.init();
  st = P.createState(stage, ship);
  buildSelect();
  showSelect();
  lastTime = performance.now();
  requestAnimationFrame(frame);

  ID.debug = { getState: function () { return st; }, stage: stage, getShip: function () { return ship; } };
})();
