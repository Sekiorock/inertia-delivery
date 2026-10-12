// 数値の設定（仕様書 3章・4章・5章）。ここを書き換えるだけで調整できる。
window.ID = window.ID || {};

ID.config = {
  version: '0.5.0',        // 画面の左下に小さく表示する（更新の確認用）
  publicUrl: 'https://sekiorock.github.io/inertia-delivery/',   // QRコードの画面に出すURL
  worldWidth: 30,          // 画面の横幅に相当する長さ [m]
  physicsHz: 120,          // 物理計算の回数 [回/秒]
  exhaustSpeed: 2000,      // 噴射ガスの速さ u [m/s]
  fuelPrice: 1000,         // 燃料の単価 [円/kg]

  // 壁との衝突（仕様書 3章）
  wallBreakSpeed: 1.0,     // 壁に垂直な向きの速さがこれを超えると荷物破損 [m/s]
  restitution: 0.3,        // 跳ね返るときの反発係数
  saveKey: 'inertia-delivery-v1',   // 端末のブラウザに保存するときの名前

  // 配達成功の条件
  dockMaxSpeed: 0.3,       // この速さ以下 [m/s]
  dockHoldTime: 1.0,       // 噴射なしでこの時間続く [s]

  // 給料（仕様書 6章）
  precisionBonusMax: 3000, // 精度ボーナスの上限 [円]。中心でこの額、円のふちで0円
  speedBonusMax: 3000,     // 速達ボーナスの上限 [円]
  speedBonusFullRatio: 0.5,// 目標時間のこの割合以下で届けると速達ボーナスが満額
  star3Ratio: 1.2,         // 手取りが基本給のこの倍以上で星3
  star2Ratio: 1.0,         // 手取りが基本給のこの倍以上で星2（成功すれば最低でも星1）

  // 操作
  stepThresholds: [0, 0.34, 0.67],   // 3段階の機体で、段が切り替わる指の位置（0〜1）
  controlAreaRatio: 0.4,   // 画面下側の操作エリアの割合
  deadZonePx: 12,          // 噴射しない「あそび」の半径 [px]
  fullPowerPx: 120,        // 最大出力になる指の移動距離 [px]

  // 矢印の長さ（見た目だけ）
  velArrowScale: 0.6,      // 速度 1 m/s あたりの長さ [m]
  accArrowScale: 2.0,      // 加速度 1 m/s² あたりの長さ [m]
  arrowMaxLength: 14,      // 矢印の長さの上限 [m]

  // 受け取り口に近づいたときのズーム（精密な操作のため）
  zoomMax: 2.5,            // 最大の拡大率
  zoomStartDist: 25,       // 受け取り口までこの距離でズームが始まる [m]
  zoomFullDist: 5,         // この距離で最大の拡大率になり、受け取り口が中央に来る [m]

  shakePx: 1.5,            // 大型機の最大出力で画面が揺れる幅 [px]
  dockEffectTime: 1.0,     // ドッキングの効果を見せる時間 [s]
  volume: 0.6,             // 音量（0〜1）

  outMargin: 15,           // ステージの上下にこれだけ出たら場外 [m]

  colors: { navy: '#1B2A49', white: '#FFFFFF',
            spaceTop: '#070C1A', spaceBottom: '#16223D' },   // 宇宙の背景（上の色と下の色）
  gridAlpha: 0.22,         // 5 m ごとの目盛り線の濃さ（0＝見えない、1＝真っ白）
  gridAlphaFine: 0.12,     // ズーム中の 1 m ごとの目盛り線の濃さ
  starCount: 110,          // 星の数

  // 機体（仕様書 5章）
  ships: {
    shizuka: {
      id: 'shizuka',
      name: 'しずか',
      tagline: '小回りが利く精密派',
      steps: null,         // 出力は連続的に調整できる
      mass: 300,           // 質量 [kg]
      maxThrust: 600,      // 最大推力 [N]
      minThrust: 30,       // 最小推力 [N]
      minBurnTime: 0.05,   // 最短の噴射時間 [s]
      jitterDeg: 4,        // 噴射の向きのぶれ（最大） [°]
      size: 1.6,           // 四角形の一辺 [m]
      color: '#F29BB8'
    },
    takeshi: {
      id: 'takeshi',
      name: 'たけし',
      tagline: 'パワーで押し切る安定派',
      mass: 1200,
      maxThrust: 4800,
      minThrust: 1440,
      steps: [0.30, 0.65, 1.00],   // 出力は3段階
      minBurnTime: 0.1,    // 最短の噴射時間 [s]（細かく止められるように 0.3 から短くした）
      jitterDeg: 0,        // ぶれなし
      size: 2.4,
      color: '#C49A3A'
    }
  },
  shipOrder: ['shizuka', 'takeshi'],
  defaultShip: 'shizuka'
};
