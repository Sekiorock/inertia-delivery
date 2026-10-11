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
      status: 'playing',     // 'playing' | 'success' | 'broken' | 'out'
      offset: 0,             // 成功時の中心からのずれ [m]
      hitSpeed: 0,           // 荷物破損のときの、壁に垂直な向きの速さ [m/s]
      bounceCount: 0,        // 壁で跳ね返った回数
      burnTime: 0,           // 今の噴射が続いている時間 [s]
      lastCmd: null,
      // ぶれ用の波の位相（ステージごとに決まる）
      jitter: [rnd() * Math.PI * 2, rnd() * Math.PI * 2, 0.23 + rnd() * 0.1, 0.61 + rnd() * 0.2]
    };
  }

  // 受け取り口の今の位置（ステージ4では動く）
  // bounds があるときは、その範囲を同じ速さで往復する。
  function dockPosition(stage, t) {
    var d = stage.dock, v = d.velocity, b = d.bounds;
    if (b && v.x !== 0) {
      var span = b.xMax - b.xMin, sp = Math.abs(v.x);
      var p = (d.x - b.xMin + sp * t) % (2 * span);
      if (p <= span) return { x: b.xMin + p, y: d.y, vx: sp, vy: 0 };
      return { x: b.xMax - (p - span), y: d.y, vx: -sp, vy: 0 };
    }
    return { x: d.x + v.x * t, y: d.y + v.y * t, vx: v.x, vy: v.y };
  }

  // 壁との衝突。機体は一辺 size の四角形として扱う。
  // 壁に垂直な向きの速さが上限以下なら跳ね返り、超えると荷物破損。
  function collide(st, px, py, ship, stage, cfg) {
    var half = ship.size / 2, walls = stage.walls;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var x0 = w.x - half, x1 = w.x + w.w + half, y0 = w.y - half, y1 = w.y + w.h + half;
      if (!(st.x > x0 && st.x < x1 && st.y > y0 && st.y < y1)) continue;
      var outX = px <= x0 || px >= x1, outY = py <= y0 || py >= y1;
      var axisX;
      if (outX && !outY) axisX = true;
      else if (outY && !outX) axisX = false;
      else axisX = Math.min(st.x - x0, x1 - st.x) < Math.min(st.y - y0, y1 - st.y);
      var vp = Math.abs(axisX ? st.vx : st.vy);
      if (vp > cfg.wallBreakSpeed + 1e-9 && !stage.noFail) {
        st.status = 'broken'; st.hitSpeed = vp;
        return;
      }
      if (axisX) {
        st.x = (st.x - x0 < x1 - st.x) ? x0 : x1;
        st.vx = -cfg.restitution * st.vx;      // 垂直な向きは逆向きで0.3倍
      } else {
        st.y = (st.y - y0 < y1 - st.y) ? y0 : y1;
        st.vy = -cfg.restitution * st.vy;      // 壁に沿った向きは変わらない
      }
      if (vp > 0.05) st.bounceCount++;
    }
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
    if (ship.steps) return ship.maxThrust * ship.steps[stepIndex(level)];   // 3段階
    return ship.minThrust + (ship.maxThrust - ship.minThrust) * level;      // 連続
  }

  // 3段階の機体で、今の指の位置が何段目か（0, 1, 2）
  function stepIndex(level) {
    var t = ID.config.stepThresholds;
    return level >= t[2] ? 2 : (level >= t[1] ? 1 : 0);
  }

  // 給料の計算（仕様書 6章）：手取り = 基本給 + 精度ボーナス + 速達ボーナス − 燃料代
  function calcPay(st, stage, cfg) {
    var precision = Math.round(cfg.precisionBonusMax * Math.max(0, 1 - st.offset / stage.dock.radius));
    var full = stage.targetTime * cfg.speedBonusFullRatio;
    var r = (stage.targetTime - st.t) / (stage.targetTime - full);
    r = r < 0 ? 0 : (r > 1 ? 1 : r);
    var speed = Math.round(cfg.speedBonusMax * r);
    var fuelCost = Math.round(st.fuel * cfg.fuelPrice);
    var gross = stage.basePay + precision + speed;
    var net = gross - fuelCost;
    var stars = net >= stage.basePay * cfg.star3Ratio ? 3 : (net >= stage.basePay * cfg.star2Ratio ? 2 : 1);
    return { base: stage.basePay, precision: precision, speed: speed, gross: gross,
             fuelCost: fuelCost, net: net, stars: stars };
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
    var px = st.x, py = st.y;
    st.x += st.vx * dt + 0.5 * ax * dt * dt;
    st.y += st.vy * dt + 0.5 * ay * dt * dt;
    st.vx += ax * dt;
    st.vy += ay * dt;
    st.ax = ax; st.ay = ay; st.thrust = F;
    st.thrustDirX = dx; st.thrustDirY = dy;
    if (st.started) st.t += dt;

    collide(st, px, py, ship, stage, cfg);
    if (st.status !== 'playing') return;

    // 場外
    if (st.x < 0 || st.x > cfg.worldWidth ||
        st.y < -cfg.outMargin || st.y > stage.height + cfg.outMargin) {
      st.status = 'out';
      return;
    }

    // 配達成功：円の内側・速さ0.3 m/s以下・噴射なしが1秒続く
    var d = dockPosition(stage, st.t);
    var dist = Math.hypot(st.x - d.x, st.y - d.y);
    var rel = Math.hypot(st.vx - d.vx, st.vy - d.vy);
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
    thrustFromLevel: thrustFromLevel,
    stepIndex: stepIndex,
    calcPay: calcPay
  };
})();
