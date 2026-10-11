// 起動、画面の切り替え、ゲームの進行
// 段階4：タイトル → 機体選択 → ステージ選択 → 依頼 → プレイ → 結果（＋効果音・振動）
// 進行状況は端末のブラウザの中だけに保存する（localStorage）。
window.ID = window.ID || {};

(function () {
  var cfg = ID.config, T = ID.texts, P = ID.physics;
  var stages = ID.stages;
  var DT = 1 / cfg.physicsHz;

  function $(id) { return document.getElementById(id); }
  function yen(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP') + T.yen; }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // ---------- 保存するデータ ----------
  // 解放したステージ、ステージごとの最高手取り・星の数、所持金、選んだ機体、音のオン・オフ
  var save = { unlocked: 0, best: {}, wallet: 0, ship: cfg.defaultShip, sound: true };
  function loadSave() {
    try {
      var d = JSON.parse(localStorage.getItem(cfg.saveKey) || 'null');
      if (d && typeof d === 'object') {
        if (typeof d.unlocked === 'number') save.unlocked = d.unlocked;
        if (d.best && typeof d.best === 'object') save.best = d.best;
        if (typeof d.wallet === 'number') save.wallet = d.wallet;
        if (cfg.ships[d.ship]) save.ship = d.ship;
        if (typeof d.sound === 'boolean') save.sound = d.sound;
      }
    } catch (e) {}   // 保存に失敗しても遊べるようにする
  }
  function writeSave() {
    try { localStorage.setItem(cfg.saveKey, JSON.stringify(save)); } catch (e) {}
  }
  loadSave();
  // 動作確認用：URLの最後に ?unlock=1 を付けると全ステージを遊べる（保存はしない）
  var unlockAll = /[?&]unlock=1/.test(location.search);
  function isUnlocked(i) { return unlockAll || i <= save.unlocked; }

  var stageIndex = Math.min(save.unlocked, stages.length - 1);
  var stage = stages[stageIndex];
  var ship = cfg.ships[save.ship];
  var st = P.createState(stage, ship);
  var paused = false, lastTime = 0, acc = 0, lastStep = -1, lastBounce = 0;
  var mode = 'title';         // 'title' | 'select' | 'stages' | 'brief' | 'play' | 'docked' | 'result'
  var dockedAt = 0, dockTimer = 0;

  var canvas = $('game');
  var screens = ['title', 'select', 'stages', 'brief', 'result'];
  function show(name) {
    mode = name;
    screens.forEach(function (s) { $(s).hidden = (s !== name); });
    $('overlay').hidden = true;
    document.body.classList.toggle('playing', name === 'play');
    clearTimeout(dockTimer);
    ID.audio.thrust(0);
    stopAnim();
    ID.input.reset(); ID.input.setEnabled(name === 'play');
  }

  // ---------- 一時停止・失敗のときの重ね表示 ----------
  function showOverlay(title, body, buttons) {
    $('overlay-title').textContent = title; $('overlay-body').textContent = body;
    var box = $('overlay-buttons'); box.innerHTML = '';
    buttons.forEach(function (b, i) {
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'btn' + (i === 0 ? ' primary' : '');
      el.textContent = b[0]; el.addEventListener('click', b[1]);
      box.appendChild(el);
    });
    $('overlay').hidden = false;
    ID.input.setEnabled(false);
  }

  // ---------- タイトル ----------
  function showTitle() { show('title'); }

  // ---------- 機体選択 ----------
  function buildSelect() {
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
      // 機体の絵（プレイ中と同じ絵を、大きさの比を保って描く）
      var cv = document.createElement('canvas'), px = 64, r = Math.min(window.devicePixelRatio || 1, 3);
      cv.width = cv.height = px * r; cv.style.width = cv.style.height = px + 'px';
      var c2 = cv.getContext('2d'); c2.scale(r, r);
      ID.render.drawShip(c2, s.id, px / 2, px / 2, s.size * 24);
      pic.appendChild(cv);
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
      card.addEventListener('click', function () {
        ship = s; save.ship = s.id; writeSave();
        showStages();
      });
      box.appendChild(card);
    });
  }
  function showSelect() { show('select'); }

  // ---------- ステージ選択 ----------
  function showStages() {
    $('stages-title').textContent = T.stageList;
    $('stages-wallet').textContent = ship.name + '　／　' + T.wallet + ' ' + yen(save.wallet);
    var list = $('stages-list'); list.innerHTML = '';
    stages.forEach(function (s, i) {
      var open = isUnlocked(i), best = save.best[s.id];
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'stage-item' + (open ? '' : ' locked'); el.id = 'stage-item-' + i;
      function add(cls, text) { var d = document.createElement('div'); d.className = cls; d.textContent = text || ''; el.appendChild(d); return d; }
      add('stage-no', String(i));
      add('stage-name', s.name);
      var stars = add('stage-stars');
      for (var k = 0; k < 3; k++) {
        var sp = document.createElement('i'); sp.textContent = '★';
        if (best && k < best.stars) sp.className = 'on';
        stars.appendChild(sp);
      }
      add('stage-sub', !open ? T.locked : (best ? T.best + ' ' + yen(best.net) : T.noRecord));
      if (open) el.addEventListener('click', function () { showBrief(i); });
      else el.disabled = true;
      list.appendChild(el);
    });
    show('stages');
  }

  // ---------- 依頼（冒頭のフック） ----------
  function showBrief(i) {
    stageIndex = i; stage = stages[i];
    st = P.createState(stage, ship);
    $('brief-label').textContent = T.request;
    $('brief-name').textContent = stage.name;
    $('brief-hook').textContent = '「' + (T.stageHooks[stage.id] || '') + '」';
    $('brief-base-l').textContent = T.basePay; $('brief-base').textContent = yen(stage.basePay);
    $('brief-time-l').textContent = T.targetTime; $('brief-time').textContent = stage.targetTime + ' s';
    show('brief');
  }

  // ---------- プレイ ----------
  function start() {
    st = P.createState(stage, ship);
    paused = false; acc = 0; lastStep = -1; lastBounce = 0;
    ID.render.reset();
    show('play');
  }
  function resume() { paused = false; $('overlay').hidden = true; ID.input.reset(); ID.input.setEnabled(true); }
  function pause() {
    if (mode !== 'play' || paused || st.status !== 'playing') return;
    paused = true;
    ID.audio.thrust(0);
    showOverlay(T.paused, '', [[T.resume, resume], [T.restart, start], [T.changeShip, showSelect], [T.stageSelect, showStages]]);
  }
  function finish() {
    var retry = [[T.retry, start], [T.changeShip, showSelect], [T.stageSelect, showStages]];
    ID.audio.thrust(0);
    if (st.status === 'success') {
      // ドッキングの効果（受け取り口が「カチッ」と閉じる）を見せてから、結果の画面へ
      mode = 'docked'; dockedAt = performance.now();
      ID.input.setEnabled(false);
      ID.audio.play('dock'); vibrate([30, 40, 30]);
      var pay = P.calcPay(st, stage, cfg);
      dockTimer = setTimeout(function () { if (mode === 'docked') showResult(pay); }, cfg.dockEffectTime * 1000);
    } else if (st.status === 'broken') {
      ID.audio.play('broken'); vibrate(80);
      showOverlay(T.broken, T.brokenBody1 + st.hitSpeed.toFixed(1) + ' m/s\n' +
        T.brokenBody2 + cfg.wallBreakSpeed.toFixed(1) + ' m/s' + T.brokenBody3, retry);
    } else {
      ID.audio.play('broken');
      showOverlay(T.out, T.outBody, retry);
    }
  }

  // ---------- 結果：総額を見せてから、燃料代を天引きする ----------
  var animId = 0, fast = false, timers = [];
  function stopAnim() { animId++; timers.forEach(clearTimeout); timers = []; }
  function showResult(pay) {
    show('result');
    fast = false;
    var my = animId;
    var amount = $('pay-amount'), box = $('pay-box'), slip = $('slip');

    // 進行状況の記録（演出の途中で画面を閉じても残るように、先に保存する）
    var old = save.best[stage.id];
    var isBest = !old || pay.net > old.net;
    if (isBest) save.best[stage.id] = { net: pay.net, stars: pay.stars };
    save.wallet += pay.net;                         // 赤字なら所持金からも引く
    if (stageIndex + 1 > save.unlocked) save.unlocked = Math.min(stageIndex + 1, stages.length - 1);
    writeSave();
    var hasNext = stageIndex + 1 < stages.length;

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
    $('wallet').textContent = (isBest && old ? T.newBest + '　／　' : '') + T.wallet + ' ' + yen(save.wallet);
    $('btn-next').hidden = !hasNext;
    $('btn-again').className = 'btn' + (hasNext ? '' : ' primary');
    $('result-buttons').classList.add('hide');
    $('skip-hint').textContent = T.skipHint;

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
          if (k < 1) { ID.audio.play(to >= from ? 'tickUp' : 'tickDown'); requestAnimationFrame(tick); }
          else next();
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
    act(function () { ID.audio.play('coin'); });
    wait(700);
    act(function () { slip.classList.add('in'); }); // 燃料代の伝票が入ってくる
    wait(700);
    count(pay.gross, pay.net, 1200);                // 総額から燃料代が減っていく
    wait(300);
    act(function () {
      $('pay-label').textContent = pay.net < 0 ? T.deficit : T.net;
      if (pay.net < 0) $('result-title').textContent = T.deficit;
      box.classList.add('final');
      ID.audio.play(pay.net < 0 ? 'deficit' : 'fanfare');
      if (isBest && old && pay.net >= 0) ID.audio.play('sparkle');   // 最高手取りの更新
      $('wallet').classList.remove('hide');
      stars.classList.remove('hide');
    });
    for (var j = 0; j < 3; j++) {
      (function (j) {
        wait(j === 0 ? 450 : 280);
        act(function () { if (j < pay.stars) { stars.children[j].classList.add('on'); ID.audio.play('star', j); } });
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
      if (step !== lastStep) { if (step >= 0) { vibrate(20); ID.audio.play('step', step); } lastStep = step; }
      acc += dt;
      while (acc >= DT) {      // 物理は1秒に120回の固定間隔
        P.step(st, cmd, DT, ship, stage, cfg);
        acc -= DT;
        if (st.status !== 'playing') { finish(); break; }
      }
      if (st.bounceCount !== lastBounce) { vibrate(10); ID.audio.play('bounce'); lastBounce = st.bounceCount; }   // 壁で跳ね返った
      // 噴射中のうなり音（出力が大きいほど音程と音量が上がる）
      if (st.status === 'playing') ID.audio.thrust(st.thrust > 0 ? st.thrust / ship.maxThrust : 0);
    }
    if (mode === 'play' || mode === 'docked') {
      var fx = { dt: paused ? 0 : dt, dock: -1 };
      if (mode === 'docked') fx.dock = Math.min(1, (now - dockedAt) / 1000 / cfg.dockEffectTime);
      ID.render.draw(st, stage, ship, ID.input.state, cmd, fx);
    }
    requestAnimationFrame(frame);
  }

  // ---------- ボタン ----------
  $('title-name').textContent = T.title;
  $('btn-begin').textContent = T.begin;
  $('btn-begin').addEventListener('click', showSelect);
  $('btn-stages-back').textContent = T.changeShip;
  $('btn-stages-back').addEventListener('click', showSelect);
  $('btn-depart').textContent = T.depart;
  $('btn-depart').addEventListener('click', start);
  $('btn-brief-back').textContent = T.back;
  $('btn-brief-back').addEventListener('click', showStages);
  $('btn-next').textContent = T.nextStage;
  $('btn-next').addEventListener('click', function () { showBrief(stageIndex + 1); });
  $('btn-again').textContent = T.retry;
  $('btn-again').addEventListener('click', start);
  $('btn-to-stages').textContent = T.stageSelect;
  $('btn-to-stages').addEventListener('click', showStages);
  $('btn-pause').addEventListener('click', pause);
  $('result').addEventListener('pointerdown', function () { fast = true; });   // タップで早送り
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    ID.audio.setSuspended(document.hidden);
  });
  // 音のオン・オフ
  function updateSound() {
    var b = $('btn-sound');
    b.classList.toggle('off', !save.sound);
    b.setAttribute('aria-label', save.sound ? T.soundOn : T.soundOff);
    ID.audio.setEnabled(save.sound);
  }
  $('btn-sound').addEventListener('click', function () { save.sound = !save.sound; writeSave(); updateSound(); });
  // どのボタンも、押すと短く高い「ピッ」
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('button')) ID.audio.play('button');
  });
  window.addEventListener('resize', ID.render.resize);
  window.addEventListener('orientationchange', ID.render.resize);

  ID.input.init(canvas, cfg);
  ID.render.init(canvas, cfg, T);
  ID.audio.init();
  updateSound();
  buildSelect();
  showTitle();
  lastTime = performance.now();
  requestAnimationFrame(frame);

  ID.debug = {
    getState: function () { return st; },
    getShip: function () { return ship; },
    getStage: function () { return stage; },
    getSave: function () { return save; }
  };
})();
