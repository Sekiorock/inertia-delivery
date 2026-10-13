// 起動、画面の切り替え、ゲームの進行
// タイトル → ステージ選択 → 依頼 → 狙う → 飛ぶ → 結果
// 各ステージは「体感」（予測線あり）→「予測」（着地点を予測してから投げる）の順に解く。
window.PB = window.PB || {};

(function () {
  var cfg = PB.config, T = PB.texts, P = PB.physics, stages = PB.stages;
  var DT = 1 / cfg.physicsHz;
  function $(id) { return document.getElementById(id); }
  function yen(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP') + T.yen; }
  function fill(tpl, o) { return tpl.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // 解く順番：ステージ1の体感 → ステージ1の予測 → ステージ2の体感 → …
  var order = [];
  stages.forEach(function (s, i) { order.push({ i: i, mode: 'feel' }); order.push({ i: i, mode: 'predict' }); });

  // ---------- 保存（端末のブラウザの中だけ） ----------
  var save = { unlocked: 0, best: {}, wallet: 0, sound: true };
  try {
    var d0 = JSON.parse(localStorage.getItem(cfg.saveKey) || 'null');
    if (d0 && typeof d0 === 'object') {
      if (typeof d0.unlocked === 'number') save.unlocked = d0.unlocked;
      if (d0.best && typeof d0.best === 'object') save.best = d0.best;
      if (typeof d0.wallet === 'number') save.wallet = d0.wallet;
      if (typeof d0.sound === 'boolean') save.sound = d0.sound;
    }
  } catch (e) {}
  function writeSave() { try { localStorage.setItem(cfg.saveKey, JSON.stringify(save)); } catch (e) {} }
  var unlockAll = /[?&]unlock=1/.test(location.search);   // 動作確認用：?unlock=1 で全部遊べる
  function isOpen(k) { return unlockAll || k <= save.unlocked; }

  // ---------- 今の状態 ----------
  var cur = 0;                         // order の何番目を遊んでいるか
  var stage = stages[0], world = cfg.worlds[stage.world], mode = 'feel';
  var st = P.createState(stage);
  var aims = {};                       // ステージごとの最後の狙い（やり直しても残る）
  var aim = { v: 10, theta: 45 };
  var pin = null, pred = null;
  var phase = 'title';                 // 'title' | 'qr' | 'stages' | 'brief' | 'aim' | 'flying' | 'landed' | 'result'
  var paused = false, acc = 0, lastTime = 0, hitAt = 0, timer = 0;

  var screens = ['title', 'qr', 'stages', 'brief', 'result'];
  function show(name) {
    phase = name;
    screens.forEach(function (s) { $(s).hidden = (s !== name); });
    $('overlay').hidden = true;
    document.body.classList.toggle('playing', ['aim', 'flying', 'landed'].indexOf(name) >= 0);
    clearTimeout(timer); stopAnim();
  }
  function showOverlay(title, body, buttons) {
    $('overlay-title').textContent = title; $('overlay-body').textContent = body;
    var box = $('overlay-buttons'); box.innerHTML = '';
    buttons.forEach(function (b, i) {
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'btn' + (i === 0 ? ' primary' : '');
      el.textContent = b[0]; el.addEventListener('click', b[1]); box.appendChild(el);
    });
    $('overlay').hidden = false;
  }

  // ---------- ステージ選択 ----------
  function showStages() {
    $('stages-title').textContent = T.stageList;
    $('stages-wallet').textContent = T.wallet + ' ' + yen(save.wallet);
    var list = $('stages-list'); list.innerHTML = '';
    var lastWorld = null;
    stages.forEach(function (s, i) {
      if (s.world !== lastWorld) {
        var h = document.createElement('div'); h.className = 'world-head';
        h.textContent = T.worldNames[s.world] + '　g = ' + cfg.worlds[s.world].g.toFixed(2) + ' m/s²';
        list.appendChild(h); lastWorld = s.world;
      }
      var card = document.createElement('div'); card.className = 'stage-card';
      var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = (i + 1) + '. ' + T.stageNames[s.id];
      card.appendChild(nm);
      var modes = document.createElement('div'); modes.className = 'modes';
      ['feel', 'predict'].forEach(function (m) {
        var k = i * 2 + (m === 'feel' ? 0 : 1), best = save.best[s.id + ':' + m];
        var b = document.createElement('button'); b.type = 'button'; b.className = 'mode-btn'; b.id = 'mode-' + s.id + '-' + m;
        var t1 = document.createElement('b'); t1.textContent = T.modeNames[m]; b.appendChild(t1);
        var stars = document.createElement('div'); stars.className = 'stars';
        for (var j = 0; j < 3; j++) { var it = document.createElement('i'); it.textContent = '★'; if (best && j < best.stars) it.className = 'on'; stars.appendChild(it); }
        b.appendChild(stars);
        var sub = document.createElement('div'); sub.className = 'sub';
        sub.textContent = !isOpen(k) ? T.locked : (best ? T.best + ' ' + yen(best.net) : T.noRecord);
        b.appendChild(sub);
        if (isOpen(k)) b.addEventListener('click', function () { showBrief(k); }); else b.disabled = true;
        modes.appendChild(b);
      });
      card.appendChild(modes); list.appendChild(card);
    });
    show('stages');
  }

  // ---------- 依頼 ----------
  function showBrief(k) {
    cur = k; stage = stages[order[k].i]; mode = order[k].mode; world = cfg.worlds[stage.world];
    $('brief-label').textContent = T.request;
    $('brief-name').textContent = T.stageNames[stage.id];
    $('brief-mode').textContent = T.worldNames[stage.world] + '　／　' + T.modeNames[mode];
    $('brief-hook').textContent = '「' + T.stageHooks[stage.id] + '」';
    $('brief-g-l').textContent = T.gravity + ' g'; $('brief-g').textContent = world.g.toFixed(2) + ' m/s²';
    $('brief-base-l').textContent = T.basePay; $('brief-base').textContent = yen(stage.basePay);
    $('brief-desc').textContent = T.modeDesc[mode];
    show('brief');
  }

  // ---------- 狙う ----------
  function startAim() {
    st = P.createState(stage);
    aim = aims[stage.id] || { v: 10, theta: 45 };
    pin = null; paused = false; acc = 0;
    document.body.classList.toggle('space', world.theme === 'space');
    PB.render.setWorldChip(T.worldNames[stage.world] + '　g = ' + world.g.toFixed(2) + ' m/s²');
    show('aim');
    updateAim();
  }
  function updateAim() {
    aim.v = Math.round(Math.max(0, Math.min(cfg.vMax, aim.v)) / cfg.speedStep) * cfg.speedStep;
    aim.theta = Math.round(Math.max(0, Math.min(90, aim.theta)) / cfg.angleStep) * cfg.angleStep;
    aims[stage.id] = { v: aim.v, theta: aim.theta };
    $('aim-v').textContent = aim.v.toFixed(1);
    $('aim-t').textContent = String(aim.theta);
    pred = mode === 'feel' && aim.v > 0 ? P.predict(stage, world.g, aim.v, aim.theta, 1 / 60) : null;
    $('btn-throw').disabled = phase !== 'aim' || aim.v <= 0 || (mode === 'predict' && pin == null);
  }
  function throwIt() {
    if (phase !== 'aim' || $('btn-throw').disabled) return;
    P.launch(st, stage, aim.v, aim.theta);
    acc = 0; show('flying'); updateAim();
    PB.audio.play('launch'); vibrate(15);
  }

  // ---------- 着地 ----------
  function landed() {
    show('landed');
    PB.audio.play('land');
    var rel = function (x) { return (x - stage.launch.x).toFixed(2); };
    if (st.result === 'hit') {
      hitAt = performance.now();
      PB.audio.play('dock'); vibrate([30, 40, 30]);
      var pay = P.calcPay(st, stage, cfg, mode, pin);
      timer = setTimeout(function () { showResult(pay); }, 1300);
    } else {
      PB.audio.play('miss');
      var body = T.missLand + ' ' + rel(st.x) + ' m ／ ' + T.basketAt + ' ' + rel(stage.basket.x) + ' m';
      if (pin != null) body += '\n' + T.predictLabel + ' ' + rel(pin) + ' m';
      var title = st.result === 'wall' ? T.missWall : (st.result === 'out' ? T.missOut : T.missTitle);
      timer = setTimeout(function () {
        showOverlay(title, body, [[T.retrySame, startAim], [T.stageSelect, showStages]]);
      }, 900);
    }
  }

  // ---------- 結果：総額を見せてから、エネルギー代を引く ----------
  var animId = 0, fast = false, timers = [];
  function stopAnim() { animId++; timers.forEach(clearTimeout); timers = []; }
  function showResult(pay) {
    show('result'); fast = false;
    var my = animId, amount = $('pay-amount'), box = $('pay-box'), slip = $('slip');
    var key = stage.id + ':' + mode, old = save.best[key], isBest = !old || pay.net > old.net;
    if (isBest) save.best[key] = { net: pay.net, stars: pay.stars };
    save.wallet += pay.net;
    if (cur + 1 > save.unlocked) save.unlocked = Math.min(cur + 1, order.length - 1);
    writeSave();

    $('result-title').textContent = T.success;
    var data = fill(T.flightData, { t: st.t.toFixed(2), h: st.maxY.toFixed(2), x: (st.x - stage.launch.x).toFixed(2) });
    if (pay.err != null) data += '\n' + fill(T.predictErr, { e: pay.err.toFixed(2) });
    $('result-data').textContent = data; $('result-data').style.whiteSpace = 'pre-line';
    function row(id, label, value, showIt) {
      var el = $(id); el.children[0].textContent = label; el.children[1].textContent = '+' + yen(value);
      el.classList.add('hide'); el.style.display = showIt ? '' : 'none';
    }
    row('row-base', T.basePay, pay.base, true);
    row('row-precision', T.precisionBonus, pay.precision, true);
    row('row-predict', T.predictBonus, pay.predict, mode === 'predict');
    $('pay-label').textContent = T.gross; amount.textContent = yen(0);
    box.classList.remove('final'); box.classList.add('hide');
    $('slip-label').textContent = T.energySlip + '（' + Math.round(pay.energy) + ' J）';
    $('slip-amount').textContent = '−' + yen(pay.cost);
    slip.classList.remove('in');
    var stars = $('stars'); stars.innerHTML = '';
    for (var i = 0; i < 3; i++) { var sp = document.createElement('span'); sp.textContent = '★'; stars.appendChild(sp); }
    stars.classList.add('hide');
    $('wallet').textContent = (isBest && old ? T.newBest + '　／　' : '') + T.wallet + ' ' + yen(save.wallet);
    $('wallet').classList.add('hide');
    $('btn-next').hidden = cur + 1 >= order.length;
    $('btn-again').className = 'btn' + (cur + 1 >= order.length ? ' primary' : '');
    $('result-buttons').classList.add('hide');
    $('skip-hint').textContent = T.skipHint;

    var queue = [];
    function wait(ms) { queue.push(function (next) { if (fast) next(); else timers.push(setTimeout(next, ms)); }); }
    function act(fn) { queue.push(function (next) { fn(); next(); }); }
    function count(from, to, ms) {
      queue.push(function (next) {
        var t0 = performance.now();
        (function tick(now) {
          if (my !== animId) return;
          var k = fast ? 1 : Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
          amount.textContent = yen(Math.round(from + (to - from) * e));
          if (k < 1) { PB.audio.play(to >= from ? 'tickUp' : 'tickDown'); requestAnimationFrame(tick); } else next();
        })(t0);
      });
    }
    function run() { if (my !== animId) return; var f = queue.shift(); if (f) f(run); }
    wait(400);
    ['row-base', 'row-precision', 'row-predict'].forEach(function (id) {
      act(function () { $(id).classList.remove('hide'); }); wait(220);
    });
    act(function () { box.classList.remove('hide'); });
    count(0, pay.gross, 900);
    act(function () { PB.audio.play('coin'); });
    wait(600);
    act(function () { slip.classList.add('in'); });
    wait(650);
    count(pay.gross, pay.net, 1000);
    wait(250);
    act(function () {
      $('pay-label').textContent = pay.net < 0 ? T.deficit : T.net;
      box.classList.add('final');
      PB.audio.play(pay.net < 0 ? 'deficit' : 'fanfare');
      if (isBest && old && pay.net >= 0) PB.audio.play('sparkle');
      $('wallet').classList.remove('hide'); stars.classList.remove('hide');
    });
    for (var j = 0; j < 3; j++) (function (j) {
      wait(j === 0 ? 420 : 260);
      act(function () { if (j < pay.stars) { stars.children[j].classList.add('on'); PB.audio.play('star', j); } });
    })(j);
    wait(200);
    act(function () { $('result-buttons').classList.remove('hide'); $('skip-hint').textContent = ''; });
    run();
  }

  // ---------- 毎フレーム ----------
  function frame(now) {
    var dt = (now - lastTime) / 1000; lastTime = now;
    if (dt > 0.1) dt = 0.1;
    if (phase === 'flying' && !paused) {
      acc += dt;
      while (acc >= DT && st.flying) { P.step(st, stage, world.g, DT); acc -= DT; }
      if (!st.flying) landed();
    }
    if (['aim', 'flying', 'landed'].indexOf(phase) >= 0) {
      PB.render.draw({ st: st, stage: stage, world: world, mode: mode, aim: aim, pred: pred, pin: pin, dt: dt,
                       fx: { hit: phase === 'landed' && st.result === 'hit' ? Math.min(1, (now - hitAt) / 1000) : null } });
    }
    requestAnimationFrame(frame);
  }

  // ---------- 操作 ----------
  PB.input.init($('game'), cfg, {
    enabled: function () { return phase === 'aim' && !paused; },
    aim: function (v, th) { aim.v = v; aim.theta = th; updateAim(); },
    tapStage: function (px) {
      if (mode !== 'predict') return;
      var x = PB.render.toWorldX(px);
      pin = Math.max(stage.launch.x, Math.min(stage.width, Math.round(x * 10) / 10));
      PB.audio.play('pin'); updateAim();
    }
  });
  PB.input.repeatButton($('t-minus'), function () { if (phase === 'aim') { aim.theta -= cfg.angleStep; updateAim(); } });
  PB.input.repeatButton($('t-plus'), function () { if (phase === 'aim') { aim.theta += cfg.angleStep; updateAim(); } });
  PB.input.repeatButton($('v-minus'), function () { if (phase === 'aim') { aim.v -= cfg.speedStep; updateAim(); } });
  PB.input.repeatButton($('v-plus'), function () { if (phase === 'aim') { aim.v += cfg.speedStep; updateAim(); } });
  $('btn-throw').addEventListener('click', throwIt);
  $('btn-pause').addEventListener('click', function () {
    if (phase !== 'aim' && phase !== 'flying') return;
    paused = true;
    showOverlay(T.paused, '', [[T.resume, function () { paused = false; $('overlay').hidden = true; }], [T.stageSelect, showStages]]);
  });
  document.addEventListener('visibilitychange', function () {
    PB.audio.setSuspended(document.hidden);
    if (document.hidden && phase === 'flying') $('btn-pause').click();
  });
  function updateSound() {
    $('btn-sound').classList.toggle('off', !save.sound);
    $('btn-sound').setAttribute('aria-label', save.sound ? T.soundOn : T.soundOff);
    PB.audio.setEnabled(save.sound);
  }
  $('btn-sound').addEventListener('click', function () { save.sound = !save.sound; writeSave(); updateSound(); });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button')) PB.audio.play('button'); });

  // ---------- 文言とボタン ----------
  document.title = T.title;
  $('title-company').textContent = T.company;
  $('title-name').textContent = T.title;
  $('title-mascot').textContent = T.mascot;
  $('btn-begin').textContent = T.begin; $('btn-begin').addEventListener('click', showStages);
  $('btn-qr').textContent = T.qrButton; $('btn-qr').addEventListener('click', function () { show('qr'); });
  $('qr-name').textContent = T.title; $('qr-title').textContent = T.qrTitle; $('qr-url').textContent = cfg.publicUrl;
  $('btn-qr-back').textContent = T.qrBack; $('btn-qr-back').addEventListener('click', function () { show('title'); });
  $('btn-depart').textContent = T.depart; $('btn-depart').addEventListener('click', startAim);
  $('btn-brief-back').textContent = T.back; $('btn-brief-back').addEventListener('click', showStages);
  $('btn-throw').textContent = T.throwBtn;
  $('btn-pause').setAttribute('aria-label', T.pauseLabel);
  $('btn-next').textContent = T.next; $('btn-next').addEventListener('click', function () { showBrief(cur + 1); });
  $('btn-again').textContent = T.retry; $('btn-again').addEventListener('click', startAim);
  $('btn-to-stages').textContent = T.stageSelect; $('btn-to-stages').addEventListener('click', showStages);
  $('result').addEventListener('pointerdown', function () { fast = true; });
  $('version').textContent = 'v' + cfg.version;
  window.addEventListener('resize', PB.render.resize);
  window.addEventListener('orientationchange', PB.render.resize);

  // タイトルのくりまんじゅう
  (function () {
    var cv = $('title-kuri'), r = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = cv.height = 140 * r; var c = cv.getContext('2d'); c.scale(r, r);
    PB.render.drawKuri(c, 70, 80, 46, -0.08, 'happy');
  })();

  PB.render.init($('game'), cfg, T);
  PB.audio.init();
  updateSound();
  if (/[?&]qr=1/.test(location.search)) show('qr'); else show('title');
  lastTime = performance.now();
  requestAnimationFrame(frame);

  PB.debug = { st: function () { return st; }, aim: aim, setAim: function (v, t) { aim.v = v; aim.theta = t; updateAim(); },
               phase: function () { return phase; }, setPin: function (x) { pin = x; updateAim(); } };
})();
