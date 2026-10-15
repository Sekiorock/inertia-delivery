// 電子音の合成（仕様書 8章）
// 音声ファイルは使わず、ブラウザの音声合成機能（Web Audio API）でその場で作る。
window.ID = window.ID || {};

(function () {
  var ac = null, master = null, enabled = true, lastTick = 0;
  var thr = null;   // 噴射中のうなり音

  // 音を出す準備。スマホでは、画面に触れたあとでないと音を出せない。
  function ensure() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { ac = null; return false; }
    master = ac.createGain();
    master.gain.value = enabled ? ID.config.volume : 0;
    master.connect(ac.destination);
    return true;
  }
  // iPhoneの消音スイッチがオンでも鳴るように、音の種類を「再生」にする。
  // iOS 17以降は audioSession で指定できる。それより古いiOSでは、無音の音声を
  // 流し続けることで同じ状態にする（よく使われる方法）。
  var keepAlive = null;
  function silentWav() {
    var n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    for (var i = 0; i < n; i++) b[44 + i] = 128;
    var s = ''; for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + btoa(s);
  }
  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function playbackMode() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
    } catch (e) {}
    if (!isIOS() || !enabled) return;
    try {
      if (!keepAlive) {
        keepAlive = document.createElement('audio');
        keepAlive.src = silentWav(); keepAlive.loop = true;
        keepAlive.setAttribute('playsinline', ''); keepAlive.setAttribute('x-webkit-airplay', 'deny');
      }
      if (keepAlive.paused) { var p = keepAlive.play(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  }

  var primed = false;
  function unlock() {
    if (!ensure()) return;
    playbackMode();
    if (ac.state !== 'running') { try { var p = ac.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    if (!primed) {
      // 画面に触れた瞬間に無音を1回鳴らすと、iPhoneでも音が出せる状態になる
      try {
        var src = ac.createBufferSource();
        src.buffer = ac.createBuffer(1, 1, 22050);
        src.connect(ac.destination); src.start(0);
        primed = true;
      } catch (e) {}
    }
  }
  function init() {
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, unlock, true);
    });
  }
  function setEnabled(v) {
    enabled = v;
    if (keepAlive && !v) keepAlive.pause();
    if (ac) master.gain.setTargetAtTime(v ? ID.config.volume : 0, ac.currentTime, 0.02);
  }
  // 画面が隠れたら止め、戻ったら再開する
  function setSuspended(v) {
    if (keepAlive) { try { if (v) keepAlive.pause(); } catch (e) {} }
    if (!ac) return;
    try { if (v) ac.suspend(); else ac.resume(); } catch (e) {}
  }

  // 1つの音。f0 から f1 へ音程を動かせる。
  function tone(type, f0, f1, dur, vol, delay) {
    var t = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBuf = null;
  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function noise(f0, f1, dur, vol, delay) {
    var t = ac.currentTime + (delay || 0);
    var src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuffer();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function play(name, n) {
    if (!enabled || !ensure()) return;
    if (ac.state !== 'running') { try { ac.resume(); } catch (e) {} return; }
    var i;
    switch (name) {
      case 'button':    // 短く高い「ピッ」
        tone('square', 1320, 1320, 0.06, 0.10); break;
      case 'step':      // 段ごとに上がる「カチッ」
        tone('square', [520, 700, 940][n || 0], 0, 0.045, 0.16); break;
      case 'bounce':    // 軽い「ポン」
        tone('sine', 330, 150, 0.14, 0.30); break;
      case 'broken':    // 短い「ガシャン」と下がる音
        noise(5000, 200, 0.45, 0.45);
        tone('sawtooth', 420, 60, 0.45, 0.20); break;
      case 'dock':      // 「カチッ」と、明るい和音の「キラーン」
        tone('square', 1800, 0, 0.03, 0.14);
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, j) { tone('triangle', f, f, 0.7, 0.14, 0.05 + j * 0.03); });
        tone('sine', 2093, 2093, 0.6, 0.06, 0.16); break;
      case 'tickUp':    // 数字が回るたびに細かい「チチチチ」
      case 'tickDown':  // 減るときは少し低い
        if (ac.currentTime - lastTick < 0.05) return;
        lastTick = ac.currentTime;
        tone('square', name === 'tickUp' ? 1500 : 800, 0, 0.022, 0.07); break;
      case 'coin':      // 止まったら「チャリン」
        tone('sine', 1568, 1568, 0.09, 0.16);
        tone('sine', 2093, 2093, 0.35, 0.16, 0.08); break;
      case 'fanfare':   // 上がっていく短いファンファーレ
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, j) {
          tone('square', f, f, j === 3 ? 0.35 : 0.1, 0.10, j * 0.09);
        }); break;
      case 'deficit':   // 赤字のときは下がる音
        [392, 330, 262].forEach(function (f, j) { tone('square', f, f, j === 2 ? 0.35 : 0.12, 0.10, j * 0.12); }); break;
      case 'star':      // 星ごとに音程が上がる「ピコン」
        var f = [880, 1108.7, 1318.5][n || 0];
        tone('triangle', f, f, 0.08, 0.16);
        tone('triangle', f * 1.5, f * 1.5, 0.22, 0.16, 0.07); break;
      case 'sparkle':   // 連続する「キラキラ」
        for (i = 0; i < 8; i++) tone('sine', 1600 + Math.random() * 2000, 0, 0.12, 0.07, 0.4 + i * 0.07);
        break;
    }
  }

  // 噴射中の低いうなり音。level は出力（0〜1）。0 で止まる。
  function thrust(level) {
    if (!ac) { if (level <= 0 || !enabled || !ensure()) return; }
    if (ac.state !== 'running') return;
    if (!thr) {
      if (level <= 0) return;
      thr = { osc: ac.createOscillator(), src: ac.createBufferSource(),
              flt: ac.createBiquadFilter(), nflt: ac.createBiquadFilter(),
              g: ac.createGain(), ng: ac.createGain() };
      thr.osc.type = 'sawtooth';
      thr.flt.type = 'lowpass';
      thr.src.buffer = noiseBuffer(); thr.src.loop = true;
      thr.nflt.type = 'bandpass'; thr.nflt.Q.value = 0.7;
      thr.g.gain.value = 0; thr.ng.gain.value = 0;
      thr.osc.connect(thr.flt); thr.flt.connect(thr.g); thr.g.connect(master);
      thr.src.connect(thr.nflt); thr.nflt.connect(thr.ng); thr.ng.connect(master);
      thr.osc.start(); thr.src.start();
    }
    var t = ac.currentTime, on = level > 0 && enabled;
    // 出力が大きいほど音程と音量が上がる
    thr.osc.frequency.setTargetAtTime(48 + 70 * level, t, 0.04);
    thr.flt.frequency.setTargetAtTime(220 + 700 * level, t, 0.04);
    thr.nflt.frequency.setTargetAtTime(500 + 1500 * level, t, 0.04);
    thr.g.gain.setTargetAtTime(on ? 0.05 + 0.13 * level : 0, t, 0.03);
    thr.ng.gain.setTargetAtTime(on ? 0.03 + 0.12 * level : 0, t, 0.03);
  }

  // 動作確認用：今の音の状態
  function status() {
    return { context: ac ? ac.state : 'none', session: navigator.audioSession ? navigator.audioSession.type : 'none',
             keepAlive: keepAlive ? (keepAlive.paused ? 'paused' : 'playing') : 'none', enabled: enabled };
  }

  ID.audio = { init: init, play: play, thrust: thrust, setEnabled: setEnabled, setSuspended: setSuspended, status: status };
})();
