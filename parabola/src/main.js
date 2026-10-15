// 起動、画面の切り替え、ゲームの進行
// タイトル → ステージ選択 → 依頼 → 狙う → 飛ぶ → 結果
// 各ステージは「体感」（予測線あり）→「予測」（着地点を予測してから投げる）
// →「見積もり」（飛行時間などを計算して入力してから投げる）→「設計」（数値だけで一発勝負）の順に解く。
// 次のステージの体感は、前のステージの予測をクリアすると遊べる。
// 体感の段階では、飛んでいる途中で時間を止めて、速度や加速度の向きを問う（途中停止クイズ）。
window.PB = window.PB || {};

(function () {
  var cfg = PB.config, T = PB.texts, P = PB.physics, stages = PB.stages;
  var DT = 1 / cfg.physicsHz;
  function $(id) { return document.getElementById(id); }
  function yen(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP') + T.yen; }
  // 重力の表示：斜面では g sinθ、それ以外は g
  function gText(w) { return (w.slope ? 'g sinθ = ' : 'g = ') + w.g.toFixed(2) + ' m/s²'; }
  function fill(tpl, o) { return tpl.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // 解く順番：ステージ1の体感 → ステージ1の予測 → ステージ2の体感 → …
  var MODES = ['feel', 'predict', 'estimate', 'design'];
  var order = [];
  stages.forEach(function (s, i) { MODES.forEach(function (m) { order.push({ i: i, mode: m }); }); });

  // ---------- 保存（端末のブラウザの中だけ） ----------
  var save = { cleared: {}, best: {}, wallet: 0, sound: true, shadow: true, quiz: {} };
  try {
    var d0 = JSON.parse(localStorage.getItem(cfg.saveKey) || 'null');
    if (d0 && typeof d0 === 'object') {
      if (d0.cleared && typeof d0.cleared === 'object') save.cleared = d0.cleared;
      else if (typeof d0.unlocked === 'number') {   // 古い保存の形（体感・予測の2段階）から引き継ぐ
        for (var j = 0; j < d0.unlocked; j++) if (stages[j >> 1]) save.cleared[stages[j >> 1].id + ':' + (j % 2 ? 'predict' : 'feel')] = true;
      }
      if (d0.best && typeof d0.best === 'object') save.best = d0.best;
      if (typeof d0.wallet === 'number') save.wallet = d0.wallet;
      if (typeof d0.sound === 'boolean') save.sound = d0.sound;
      if (typeof d0.shadow === 'boolean') save.shadow = d0.shadow;
      if (d0.quiz && typeof d0.quiz === 'object') save.quiz = d0.quiz;
    }
  } catch (e) {}
  function writeSave() { try { localStorage.setItem(cfg.saveKey, JSON.stringify(save)); } catch (e) {} }
  var unlockAll = /[?&]unlock=1/.test(location.search);   // 動作確認用：?unlock=1 で全部遊べる
  function cleared(i, m) { return !!(stages[i] && save.cleared[stages[i].id + ':' + m]); }
  function isOpen(k) {
    if (unlockAll || k === 0) return true;
    var i = order[k].i, m = MODES.indexOf(order[k].mode);
    if (m === 0 && (i === 0 || stages[i - 1].chapter !== stages[i].chapter)) return true;   // 章の最初のステージ
    return m === 0 ? cleared(i - 1, 'predict') : cleared(i, MODES[m - 1]);
  }

  // ---------- 今の状態 ----------
  var cur = 0;                         // order の何番目を遊んでいるか
  var stage = stages[0], world = cfg.worlds[stage.world], mode = 'feel';
  var st = P.createState(stage);
  var aims = {};                       // ステージごとの最後の狙い（やり直しても残る）
  var aim = { v: 10, theta: 45 };
  var pin = null, pred = null;
  var phase = 'title';                 // 'title' | 'qr' | 'stages' | 'brief' | 'aim' | 'flying' | 'landed' | 'result'
  var paused = false, acc = 0, lastTime = 0, hitAt = 0, timer = 0;
  // 途中停止クイズ
  var quizPending = [], quizActive = false, quizEarned = 0, arrowsHidden = false, vy0 = 0, quizAt = null;
  // 見積もり・設計
  var est = null, estInputs = {}, designInputs = {}, designTries = 0, emin = {};

  var screens = ['title', 'qr', 'stages', 'brief', 'result'];
  function show(name) {
    phase = name;
    screens.forEach(function (s) { $(s).hidden = (s !== name); });
    $('overlay').hidden = true;
    document.body.classList.toggle('playing', ['aim', 'flying', 'landed'].indexOf(name) >= 0);
    clearTimeout(timer); stopAnim();
    if (['flying', 'landed'].indexOf(name) < 0) { $('quiz').hidden = true; quizActive = false; }
    if (name !== 'aim') $('sheet').hidden = true;
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
    var lastWorld = null, lastChapter = null;
    stages.forEach(function (s, i) {
      if (s.chapter !== lastChapter) {
        var ch = document.createElement('div'); ch.className = 'chapter-head';
        ch.textContent = T.chapterNames[s.chapter] || ''; list.appendChild(ch); lastChapter = s.chapter;
      }
      if (s.world !== lastWorld) {
        var h = document.createElement('div'); h.className = 'world-head';
        h.textContent = T.worldNames[s.world] + '　' + gText(cfg.worlds[s.world]);
        list.appendChild(h); lastWorld = s.world;
      }
      var card = document.createElement('div'); card.className = 'stage-card';
      var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = (i + 1) + '. ' + T.stageNames[s.id];
      card.appendChild(nm);
      var modes = document.createElement('div'); modes.className = 'modes';
      MODES.forEach(function (m, mi) {
        var k = i * MODES.length + mi, best = save.best[s.id + ':' + m];
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
    designTries = 0;
    $('brief-label').textContent = T.request;
    $('brief-name').textContent = T.stageNames[stage.id];
    $('brief-mode').textContent = T.worldNames[stage.world] + '　／　' + T.modeNames[mode];
    $('brief-hook').textContent = '「' + T.stageHooks[stage.id] + '」';
    $('brief-g-l').textContent = world.slope ? T.slopeAcc : T.gravity + ' g'; $('brief-g').textContent = world.g.toFixed(2) + ' m/s²';
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
    PB.render.setWorldChip(T.worldNames[stage.world] + '　' + gText(world));
    cfg.vMax = stage.vMax || cfg.vMaxDefault;   // ステージごとの速さの上限
    $('lbl-y').textContent = world.slope ? T.hud.ySlope : T.hud.y;
    $('lbl-x').textContent = world.slope ? T.hud.xSlope : T.hud.x;
    show('aim');
    $('btn-throw').textContent = mode === 'estimate' ? T.estimateBtn : T.throwBtn;
    if (mode === 'design') {   // 設計：数値だけで狙う
      var di = designInputs[stage.id] || {};
      aim = { v: parseNum(di.v) || 0, theta: parseNum(di.t) != null ? parseNum(di.t) : 0 };
      openSheet();
    }
    updateAim();
  }
  function updateAim() {
    if (mode !== 'design') {
      aim.v = Math.round(Math.max(0, Math.min(cfg.vMax, aim.v)) / cfg.speedStep) * cfg.speedStep;
      aim.theta = Math.round(Math.max(0, Math.min(90, aim.theta)) / cfg.angleStep) * cfg.angleStep;
      aims[stage.id] = { v: aim.v, theta: aim.theta };
    }
    $('aim-v').textContent = aim.v.toFixed(mode === 'design' ? 2 : 1);
    $('aim-t').textContent = mode === 'design' ? String(Math.round(aim.theta * 100) / 100) : String(aim.theta);
    pred = mode === 'feel' && aim.v > 0 ? P.predict(stage, world.g, aim.v, aim.theta, 1 / 60) : null;
    $('btn-throw').disabled = phase !== 'aim' || aim.v <= 0 || (mode === 'predict' && pin == null);
  }
  function throwIt() {
    if (phase !== 'aim') return;
    if (mode === 'estimate' && $('sheet').hidden) { openSheet(); return; }   // 見積もりを入力してから
    if (mode !== 'design' && $('btn-throw').disabled) return;
    if (mode === 'design') designTries++;
    $('sheet').hidden = true;
    P.launch(st, stage, aim.v, aim.theta);
    acc = 0; show('flying'); updateAim();
    // まだ正解していないクイズだけを出す（体感の段階のみ）
    quizPending = [];
    if (mode === 'feel' && stage.quiz) stage.quiz.forEach(function (q, i) {
      if (!save.quiz[stage.id + ':' + i]) quizPending.push({ q: q, key: stage.id + ':' + i });
    });
    quizEarned = 0; quizActive = false; quizAt = null;
    arrowsHidden = quizPending.length > 0;   // 答える前に矢印で答えが分からないように隠す
    vy0 = st.vy;
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
      var extra = { quiz: quizEarned }, lines = [];
      var actual = { t: st.t, h: st.maxY - stage.launch.y, x: st.x - stage.launch.x };
      if (mode === 'estimate' && est) {
        extra.estimate = 0;
        [['t', T.estT, 's'], ['h', T.estH, 'm'], ['x', T.estX, 'm']].forEach(function (f) {
          var a = actual[f[0]], e = est[f[0]], p = Math.abs(e - a) / Math.max(Math.abs(a), 0.01) * 100;
          var k = p <= cfg.estimateFullPct ? 1 : Math.max(0, (cfg.estimateZeroPct - p) / (cfg.estimateZeroPct - cfg.estimateFullPct));
          extra.estimate += Math.round(cfg.estimateBonusEach * k);
          lines.push(fill(T.estLine, { name: f[1], e: e.toFixed(2) + ' ' + f[2], a: a.toFixed(2) + ' ' + f[2], p: p.toFixed(1) }));
        });
      }
      if (mode === 'design') {
        var mn = minE();
        extra.design = designTries === 1 ? cfg.designBonus : 0;
        var E = 0.5 * cfg.parcelMass * st.v0 * st.v0;
        if (mn) {
          var ratio = E / mn.energy;
          extra.efficiency = Math.round(cfg.efficiencyBonusMax * Math.max(0, Math.min(1, (cfg.efficiencyZeroRatio - ratio) / (cfg.efficiencyZeroRatio - 1))));
          lines.push(fill(T.designLine, { emin: Math.round(mn.energy), th: mn.theta.toFixed(1), e: Math.round(E), r: Math.round(ratio * 100) }));
        }
        lines.push(designTries === 1 ? T.firstTry : fill(T.laterTry, { n: designTries }));
      }
      var pay = P.calcPay(st, stage, cfg, mode, pin, extra);
      pay.lines = lines;
      timer = setTimeout(function () { showResult(pay); }, 1300);
    } else {
      PB.audio.play('miss');
      var body = (st.result === 'top' ? '' : T.missLand + ' ' + rel(st.x) + ' m ／ ') + T.basketAt + ' ' + rel(stage.basket.x) + ' m';
      if (pin != null) body += '\n' + T.predictLabel + ' ' + rel(pin) + ' m';
      if (mode === 'estimate' || mode === 'design') body += '\n' + fill(T.actualLine, { t: st.t.toFixed(2), h: (st.maxY - stage.launch.y).toFixed(2), x: rel(st.x) });
      var title = st.result === 'wall' ? T.missWall : (st.result === 'out' ? T.missOut : (st.result === 'top' ? T.missTop : T.missTitle));
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
    save.cleared[key] = true;
    writeSave();

    $('result-title').textContent = T.success;
    var data = fill(T.flightData, { t: st.t.toFixed(2), h: st.maxY.toFixed(2), x: (st.x - stage.launch.x).toFixed(2) });
    if (pay.err != null) data += '\n' + fill(T.predictErr, { e: pay.err.toFixed(2) });
    if (pay.lines && pay.lines.length) data += '\n' + pay.lines.join('\n');
    $('result-data').textContent = data; $('result-data').style.whiteSpace = 'pre-line';
    function row(id, label, value, showIt) {
      var el = $(id); el.children[0].textContent = label; el.children[1].textContent = '+' + yen(value);
      el.classList.add('hide'); el.style.display = showIt ? '' : 'none';
    }
    row('row-base', T.basePay, pay.base, true);
    row('row-precision', T.precisionBonus, pay.precision, true);
    row('row-predict', T.predictBonus, pay.predict, mode === 'predict');
    row('row-quiz', T.quizBonus, pay.quiz, pay.quiz > 0);
    row('row-estimate', T.estimateBonus, pay.estimate, mode === 'estimate');
    row('row-design', T.designBonus, pay.design, mode === 'design');
    row('row-eff', T.effBonus, pay.efficiency, mode === 'design');
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
    ['row-base', 'row-precision', 'row-predict', 'row-quiz', 'row-estimate', 'row-design', 'row-eff'].forEach(function (id) {
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

  // ---------- 数値を入力するシート（見積もり・設計） ----------
  // 全角の数字や「，」も受け付ける
  function parseNum(s) {
    if (s == null) return null;
    s = String(s).replace(/[０-９．，－]/g, function (c) { return '0123456789.,-'['０１２３４５６７８９．，－'.indexOf(c)]; }).replace(',', '.').trim();
    if (s === '' || isNaN(Number(s))) return null;
    return Number(s);
  }
  function minE() {
    if (!(stage.id in emin)) emin[stage.id] = P.minEnergy(stage, world.g, cfg);
    return emin[stage.id];
  }
  function field(id, label, unit, value) {
    var l = document.createElement('label'); l.className = 'field';
    var a = document.createElement('span'); a.className = 'fl'; a.textContent = label;
    var inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.id = id; inp.value = value == null ? '' : value;
    inp.setAttribute('autocomplete', 'off');
    var u = document.createElement('span'); u.className = 'fu'; u.textContent = unit;
    l.appendChild(a); l.appendChild(inp); l.appendChild(u);
    return l;
  }
  function openSheet() {
    var f = $('sheet-fields'); f.innerHTML = ''; $('sheet-msg').textContent = '';
    $('sheet-throw').textContent = T.sheetThrow;
    if (mode === 'estimate') {
      var e = estInputs[stage.id] || {};
      $('sheet-title').textContent = T.estimateTitle;
      $('sheet-sub').textContent = fill(T.estimateSub, { v: aim.v.toFixed(1), t: aim.theta });
      f.appendChild(field('in-t', T.estT, 's', e.t));
      f.appendChild(field('in-h', T.estH, 'm', e.h));
      f.appendChild(field('in-x', T.estX, 'm', e.x));
      $('sheet-back').textContent = T.sheetBack;
    } else {
      var d = designInputs[stage.id] || {};
      $('sheet-title').textContent = T.designTitle;
      $('sheet-sub').textContent = fill(T.designSub, { x: (stage.basket.x - stage.launch.x).toFixed(1), h: (stage.basket.y - stage.launch.y).toFixed(1), g: world.g.toFixed(2) }).replace('g = ', world.slope ? 'g sinθ = ' : 'g = ');
      f.appendChild(field('in-v', T.fieldV, 'm/s', d.v));
      f.appendChild(field('in-th', T.fieldTheta, '°', d.t));
      ['in-v', 'in-th'].forEach(function (id) {
        $(id).addEventListener('input', function () {
          $('sheet-msg').textContent = '';
          designInputs[stage.id] = { v: $('in-v').value, t: $('in-th').value };
          var v = parseNum($('in-v').value), th = parseNum($('in-th').value);
          if (v != null && th != null && v >= 0 && v <= cfg.vMax && th >= 0 && th <= 90) { aim.v = v; aim.theta = th; updateAim(); }
        });
      });
      $('sheet-back').textContent = T.stageSelect;
    }
    $('sheet').hidden = false;
  }
  $('sheet-back').addEventListener('click', function () {
    if (mode === 'design') { showStages(); return; }
    $('sheet').hidden = true;
  });
  $('sheet-throw').addEventListener('click', function () {
    if (mode === 'estimate') {
      var t = parseNum($('in-t').value), h = parseNum($('in-h').value), x = parseNum($('in-x').value);
      estInputs[stage.id] = { t: $('in-t').value, h: $('in-h').value, x: $('in-x').value };
      if (t == null || h == null || x == null) { $('sheet-msg').textContent = T.inputError; return; }
      est = { t: t, h: h, x: x };
    } else {
      var v = parseNum($('in-v').value), th = parseNum($('in-th').value);
      if (v == null || th == null) { $('sheet-msg').textContent = T.inputError; return; }
      if (v <= 0 || v > cfg.vMax || th < 0 || th > 90) { $('sheet-msg').textContent = fill(T.rangeError, { vmax: cfg.vMax }); return; }
      aim.v = v; aim.theta = th;   // 入力した値をそのまま使う（丸めない）
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    throwIt();
  });

  // ---------- 途中停止クイズ ----------
  // 止める瞬間：rise は上向きの速度が半分になったとき、apex は最高点、descent は下向きの速度が最初の上向きの半分になったとき
  function triggered(at, pvy, vy) {
    if (at === 'apex') return pvy > 0 && vy <= 0;
    if (at === 'rise') return pvy > vy0 / 2 && vy <= vy0 / 2;
    if (at === 'descent') return pvy > -vy0 / 2 && vy <= -vy0 / 2;
    return false;
  }
  function checkQuiz(pvy) {
    if (!quizPending.length || !st.flying) return;
    if (triggered(quizPending[0].q.at, pvy, st.vy)) { quizAt = quizPending[0].q.at; openQuiz(); }
  }
  var DIRS = [['nw', '↖'], ['n', '↑'], ['ne', '↗'], ['w', '←'], ['zero', null], ['e', '→'], ['sw', '↙'], ['s', '↓'], ['se', '↘']];
  function openQuiz() {
    var item = quizPending[0], q = item.q;
    quizActive = true;
    PB.audio.play('pin'); vibrate(20);
    $('quiz-title').textContent = T.quizTitle;
    $('quiz-q').textContent = T.quizQ[q.ask];
    $('quiz-result').textContent = '';
    $('quiz-explain').textContent = fill(T.quizBonusNote, { b: cfg.quizBonus.toLocaleString('ja-JP') });
    $('quiz-go').hidden = true;
    var grid = $('quiz-grid'); grid.innerHTML = '';
    var opts = q.ask === 'accMag' ? q.options.map(function (o) { return [o, o + ' m/s²']; })
                                  : DIRS.map(function (d) { return [d[0], d[1] || T.quizZero]; });
    grid.className = q.ask === 'accMag' ? 'opts' : '';
    opts.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = o[1]; b.dataset.id = o[0];
      b.addEventListener('click', function () { answer(o[0]); });
      grid.appendChild(b);
    });
    $('quiz').hidden = false;
  }
  function answer(id) {
    var item = quizPending[0], q = item.q, ok = id === q.answer;
    Array.prototype.forEach.call($('quiz-grid').children, function (b) {
      b.disabled = true;
      if (b.dataset.id === q.answer) b.className = 'right';
      else if (b.dataset.id === id) b.className = 'wrong';
    });
    $('quiz-result').textContent = ok ? T.quizRight : T.quizWrong;
    $('quiz-explain').textContent = T.quizExplain[q.explain];
    if (ok) { save.quiz[item.key] = true; writeSave(); quizEarned += cfg.quizBonus; PB.audio.play('star', 2); }
    else PB.audio.play('miss');
    quizPending.shift();
    // 同じ瞬間の問いが残っていなければ、本当の矢印を見せる
    if (!quizPending.length || quizPending[0].q.at !== quizAt) arrowsHidden = false;
    $('quiz-go').textContent = T.quizGo; $('quiz-go').hidden = false;
  }
  $('quiz-go').addEventListener('click', function () {
    if (quizPending.length && quizPending[0].q.at === quizAt) { openQuiz(); return; }   // 同じ瞬間の次の問い
    $('quiz').hidden = true; quizActive = false; arrowsHidden = false;
  });

  // ---------- 毎フレーム ----------
  function frame(now) {
    var dt = (now - lastTime) / 1000; lastTime = now;
    if (dt > 0.1) dt = 0.1;
    if (phase === 'flying' && !paused && !quizActive) {
      acc += dt;
      while (acc >= DT && st.flying && !quizActive) {
        var pvy = st.vy;
        P.step(st, stage, world.g, DT); acc -= DT;
        checkQuiz(pvy);
      }
      if (quizActive) acc = 0;
      if (!st.flying) landed();
    }
    if (['aim', 'flying', 'landed'].indexOf(phase) >= 0) {
      PB.render.draw({ st: st, stage: stage, world: world, mode: mode, aim: aim, pred: pred, pin: pin, dt: dt,
                       shadow: save.shadow, arrows: !arrowsHidden, freeze: quizActive,
                       guides: paused || quizActive || phase === 'landed',
                       fx: { hit: phase === 'landed' && st.result === 'hit' ? Math.min(1, (now - hitAt) / 1000) : null } });
    }
    requestAnimationFrame(frame);
  }

  // ---------- 操作 ----------
  PB.input.init($('game'), cfg, {
    enabled: function () { return phase === 'aim' && !paused && mode !== 'design' && $('sheet').hidden; },
    aim: function (v, th) { aim.v = v; aim.theta = th; updateAim(); },
    tapStage: function (px) {
      if (mode !== 'predict') return;
      var x = PB.render.toWorldX(px);
      pin = Math.max(stage.launch.x, Math.min(stage.width, Math.round(x * 10) / 10));
      PB.audio.play('pin'); updateAim();
    }
  });
  PB.input.repeatButton($('t-minus'), function () { if (phase === 'aim' && mode !== 'design') { aim.theta -= cfg.angleStep; updateAim(); } });
  PB.input.repeatButton($('t-plus'), function () { if (phase === 'aim') { aim.theta += cfg.angleStep; updateAim(); } });
  PB.input.repeatButton($('v-minus'), function () { if (phase === 'aim') { aim.v -= cfg.speedStep; updateAim(); } });
  PB.input.repeatButton($('v-plus'), function () { if (phase === 'aim') { aim.v += cfg.speedStep; updateAim(); } });
  $('btn-throw').addEventListener('click', throwIt);
  $('btn-pause').addEventListener('click', function () {
    if (phase !== 'aim' && phase !== 'flying') return;
    if (phase === 'aim' && !$('sheet').hidden) return;
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
  function updateShadow() { $('btn-shadow').classList.toggle('on', save.shadow); }
  $('btn-shadow').textContent = T.shadowLabel;
  $('btn-shadow').addEventListener('click', function () { save.shadow = !save.shadow; writeSave(); updateShadow(); });
  updateShadow();
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button')) PB.audio.play('button'); });

  // ---------- 文言とボタン ----------
  document.title = T.title;
  $('title-company').textContent = T.company;
  $('title-name').textContent = T.title;
  $('title-mascot').textContent = T.mascot;
  $('btn-begin').textContent = T.begin; $('btn-begin').addEventListener('click', showStages);
  $('btn-qr').textContent = T.homeButton; $('btn-qr').addEventListener('click', function () { location.href = cfg.homeUrl; });   // ホーム画面へ
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

  PB.debug = { st: function () { return st; }, quizActive: function () { return quizActive; }, save: function () { return save; }, aim: aim, setAim: function (v, t) { aim.v = v; aim.theta = t; updateAim(); },
               phase: function () { return phase; }, setPin: function (x) { pin = x; updateAim(); } };
})();
