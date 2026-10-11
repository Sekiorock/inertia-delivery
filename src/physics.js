// 運動の計算、燃料、成功の判定（仕様書 3章）
// 壁との衝突は段階3で追加する。
window.ID = window.ID || {};

(function () {
  // 決まった種から作る乱数（同じ操作なら同じ結果になる）
  function makeRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createState(stage, ship) {
    var rnd = makeRandom(stage.seed);
    return {
      x: stage.start.x, y: stage.start.y,
      vx: 0, vy: 0,
      ax: 0, ay: 0,          // 今の加速度 [m/s²]
      thrust: 0,             // 今の推力の大きさ [N]
      thrustDirX: 0, thrustDirY: 0,
      t: 0,                  // 経過時間 [s]（最初の噴射から数える）
      started: false,
      fuel: 0,               // 使った燃料 [kg]
      hold: 0,               // 成功条件を満たし続けた時間 [s]
      status: 'playing',     // 'playing' | 'success' | 'out'
      offset: 0,             // 成功時の中心からのずれ [m]
      burnTime: 0,           // 今の噴射が続いている時間 [s]
      lastCmd: null,
      // ぶれ用の波の位相（ステージごとに決まる）
      jitter: [rnd() * Math.PI * 2, rnd() * Math.PI * 2, 0.23 + rnd() * 0.1, 0.61 + rnd() * 0.2]
    };
  }

  // 受け取り口の今の位置（ステージ4では動く）
  function dockPosition(stage, t) {
    return {
      x: stage.dock.x + stage.dock.velocity.x * t,
      y: stage.dock.y + stage.dock.velocity.y * t
    };
  }

  // 噴射の向きのぶれ [rad]。ゆっくり変化する。
  function jitterAngle(st, ship) {
    if (!ship.jitterDeg) return 0;
    var j = st.jitter;
    var w = 0.6 * Math.sin(2 * Math.PI * j[2] * st.t + j[0]) +
            0.4 * Math.sin(2 * Math.PI * j[3] * st.t + j[1]);
    return w * ship.jitterDeg * Math.PI / 180;
  }

  // 出力（0〜1）から推力 [N] を決める
  function thrustFromLevel(level, ship) {
    return ship.minThrust + (ship.maxThrust - ship.minThrust) * level;
  }

  // 1回分（dt秒）進める。cmd = { on, dirX, dirY, level }（dirは長さ1、yは上が正）
  function step(st, cmd, dt, ship, stage, cfg) {
    if (st.status !== 'playing') return;

    // 最短の噴射時間：短く触れただけでも、決まった時間は噴射が続く
    var use = null;
    if (cmd && cmd.on) {
      use = cmd;
      st.lastCmd = { on: true, dirX: cmd.dirX, dirY: cmd.dirY, level: cmd.level };
    } else if (st.burnTime > 0 && st.burnTime < ship.minBurnTime && st.lastCmd) {
      use = st.lastCmd;
    }

    var ax = 0, ay = 0, F = 0, dx = 0, dy = 0;
    if (use) {
      st.started = true;
      F = thrustFromLevel(use.level, ship);
      var ang = jitterAngle(st, ship);
      var c = Math.cos(ang), s = Math.sin(ang);
      dx = use.dirX * c - use.dirY * s;
      dy = use.dirX * s + use.dirY * c;
      ax = F * dx / ship.mass;       // a = F / m
      ay = F * dy / ship.mass;
      st.burnTime += dt;
      st.fuel += F * dt / cfg.exhaustSpeed;   // Q = Σ|F|Δt / u
    } else {
      st.burnTime = 0;
    }

    // 等加速度運動の式でそのまま計算する
    st.x += st.vx * dt + 0.5 * ax * dt * dt;
    st.y += st.vy * dt + 0.5 * ay * dt * dt;
    st.vx += ax * dt;
    st.vy += ay * dt;
    st.ax = ax; st.ay = ay; st.thrust = F;
    st.thrustDirX = dx; st.thrustDirY = dy;
    if (st.started) st.t += dt;

    // 場外
    if (st.x < 0 || st.x > cfg.worldWidth ||
        st.y < -cfg.outMargin || st.y > stage.height + cfg.outMargin) {
      st.status = 'out';
      return;
    }

    // 配達成功：円の内側・速さ0.3 m/s以下・噴射なしが1秒続く
    var d = dockPosition(stage, st.t);
    var dist = Math.hypot(st.x - d.x, st.y - d.y);
    var rel = Math.hypot(st.vx - stage.dock.velocity.x, st.vy - stage.dock.velocity.y);
    if (F === 0 && dist <= stage.dock.radius && rel <= cfg.dockMaxSpeed) {
      st.hold += dt;
      if (st.hold >= cfg.dockHoldTime) {
        st.status = 'success';
        st.offset = dist;
      }
    } else {
      st.hold = 0;
    }
  }

  ID.physics = {
    createState: createState,
    step: step,
    dockPosition: dockPosition,
    thrustFromLevel: thrustFromLevel
  };
})();
