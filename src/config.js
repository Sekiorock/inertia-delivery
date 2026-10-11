// 数値の設定（仕様書 3章・4章・5章）。ここを書き換えるだけで調整できる。
window.ID = window.ID || {};

ID.config = {
  version: '0.1.1',        // 画面の左下に小さく表示する（更新の確認用）
  worldWidth: 30,          // 画面の横幅に相当する長さ [m]
  physicsHz: 120,          // 物理計算の回数 [回/秒]
  exhaustSpeed: 2000,      // 噴射ガスの速さ u [m/s]
  fuelPrice: 1000,         // 燃料の単価 [円/kg]

  // 配達成功の条件
  dockMaxSpeed: 0.3,       // この速さ以下 [m/s]
  dockHoldTime: 1.0,       // 噴射なしでこの時間続く [s]

  // 操作
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

  outMargin: 15,           // ステージの上下にこれだけ出たら場外 [m]

  colors: { navy: '#1B2A49', white: '#FFFFFF' },

  // 機体（段階1は「しずか」だけ。「たけし」は段階2で追加）
  ships: {
    shizuka: {
      name: 'しずか',
      mass: 300,           // 質量 [kg]
      maxThrust: 600,      // 最大推力 [N]
      minThrust: 30,       // 最小推力 [N]
      minBurnTime: 0.05,   // 最短の噴射時間 [s]
      jitterDeg: 4,        // 噴射の向きのぶれ（最大） [°]
      size: 1.6,           // 四角形の一辺 [m]
      color: '#F29BB8'
    }
  },
  defaultShip: 'shizuka'
};
